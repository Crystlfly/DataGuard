"""FastAPI backend for monitoring data quality results."""

from __future__ import annotations

import subprocess
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from api.identity import get_request_identity
from api.security import require_api_token
from api.routes.database import router as database_router
from api.routes.remediation import router as remediation_router
from api.routes.users import router as users_router
from config.settings import PROJECT_ROOT, get_env
from data_sources.postgres_connector import create_monitor_engine
from services.pipeline_service import run_checks_subprocess
from services.regression_service import get_run_diff
from services.rules_service import (
    delete_table_rules_from_db,
    dry_run_table_rules,
    get_flat_rules_for_database,
    get_rules_for_database,
    infer_smart_rules,
    save_all_rules_in_db,
    save_table_rules_in_db,
)
from services.data_cleaning_policy import normalize_role
from utils.audit_logger import log_audit_event
from utils.logger import get_logger


logger = get_logger(__name__)

app = FastAPI(
    title="Automated Data Quality Monitoring API",
    version="1.0.0",
    description="Enterprise API for monitoring runs, results, alerts, SLA, and lineage.",
)


@app.on_event("startup")
def startup_event():
    try:
        from services.scheduler_service import start_scheduler
        start_scheduler()
    except Exception:
        logger.exception("Failed to initialize background scheduler on startup.")


@app.on_event("shutdown")
def shutdown_event():
    try:
        from services.scheduler_service import stop_scheduler
        stop_scheduler()
    except Exception:
        logger.exception("Error stopping background scheduler.")

raw_frontend_url = get_env("FRONTEND_URL", default="http://localhost:3000")
allowed_origins = [origin.strip() for origin in str(raw_frontend_url).split(",") if origin.strip()]
for origin in ("http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"):
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

api_v1 = APIRouter(
    prefix="/api/v1",
    tags=["v1"],
    dependencies=[Depends(require_api_token)],
)
legacy = APIRouter(
    tags=["legacy"],
    dependencies=[Depends(require_api_token)],
)


def _database_unavailable_error() -> HTTPException:
    """Return a friendly API error for database connectivity failures."""

    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database is unavailable. Check configuration and PostgreSQL status.",
    )


def fetch_all(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Execute a SELECT query and return JSON-friendly dictionaries."""

    try:
        engine = create_monitor_engine()
        with engine.begin() as connection:
            rows = connection.execute(text(query), params or {}).mappings().all()
    except SQLAlchemyError:
        logger.exception("API database query failed.")
        raise _database_unavailable_error()
    except Exception:
        logger.exception("Unexpected API query error.")
        raise _database_unavailable_error()

    return jsonable_encoder([dict(row) for row in rows])


def fetch_one(query: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Execute a SELECT query and return one JSON-friendly row."""

    rows = fetch_all(query, params)
    return rows[0] if rows else None


def execute_write(query: str, params: dict[str, Any] | None = None):
    """Execute a database write and return the SQLAlchemy result."""

    try:
        engine = create_monitor_engine()
        with engine.begin() as connection:
            return connection.execute(text(query), params or {})
    except SQLAlchemyError:
        logger.exception("API database write failed.")
        raise _database_unavailable_error()
    except Exception:
        logger.exception("Unexpected API write error.")
        raise _database_unavailable_error()


def _pagination_params(limit: int, offset: int) -> dict[str, int]:
    """Return validated pagination parameters."""

    return {"limit": int(limit), "offset": int(offset)}


def _add_filter(
    conditions: list[str],
    params: dict[str, Any],
    column_name: str,
    value: Any,
    param_name: str | None = None,
) -> None:
    """Add a safe equality filter for a fixed database column."""

    if value is None or value == "":
        return

    name = param_name or column_name
    conditions.append(f"{column_name} = :{name}")
    params[name] = value


def _add_bool_filter(
    conditions: list[str],
    params: dict[str, Any],
    column_name: str,
    value: bool | None,
    param_name: str | None = None,
) -> None:
    """Add a safe boolean equality filter for a fixed database column."""

    if value is None:
        return

    name = param_name or column_name
    conditions.append(f"{column_name} = :{name}")
    params[name] = bool(value)


def _where_clause(conditions: list[str]) -> str:
    """Build a WHERE clause from trusted condition fragments."""

    if not conditions:
        return ""
    return "WHERE " + " AND ".join(conditions)


def _client_ip(request: Request) -> str | None:
    """Return request client IP address when available."""

    if request.client is None:
        return None
    return request.client.host


def _api_identity(request: Request) -> dict[str, str]:
    """Return normalized API identity from signed session or trusted headers."""

    identity = get_request_identity(request)
    identity["role"] = normalize_role(identity.get("role"))
    return identity


def _assigned_alert_scope(identity: dict[str, str]) -> str | None:
    """Return alert assignee scope (unrestricted for simplified single-user access)."""

    return None


def _require_alert_mutation(identity: dict[str, str]) -> None:
    """Allow alert mutation for authenticated users."""

    return


def _require_admin(identity: dict[str, str]) -> None:
    """Allow full administrative actions for authenticated users."""

    return


def _ensure_alert_access(alert_id: int, identity: dict[str, str]) -> None:
    """Allow alert management access for authenticated users."""

    return


@app.get("/health", tags=["public"])
def health() -> dict[str, str]:
    """Return a public API health response."""

    return {"status": "ok", "service": "data-quality-monitoring-api"}


@app.get("/api/v1/health", tags=["public"])
def versioned_health() -> dict[str, str]:
    """Return a public versioned API health response."""

    return health()


@app.get("/ready", tags=["public"], response_model=None)
def ready() -> Any:
    """Return database readiness without exposing stack traces."""

    try:
        engine = create_monitor_engine()
        with engine.begin() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        logger.exception("API readiness check failed.")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unready", "database": "unavailable"},
        )

    return {"status": "ready", "database": "available"}


@api_v1.get("/runs")
@legacy.get("/runs")
def get_runs(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    run_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> list[dict[str, Any]]:
    """Return recent data quality runs with pagination and filters."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "run_id", run_id)
    _add_filter(conditions, params, "overall_status", status_filter, "status")

    return fetch_all(
        f"""
        SELECT *
        FROM data_quality_runs
        {_where_clause(conditions)}
        ORDER BY run_id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


@api_v1.get("/runs/latest")
@legacy.get("/runs/latest")
def get_latest_run() -> dict[str, Any]:
    """Return the latest data quality run."""

    row = fetch_one(
        """
        SELECT *
        FROM data_quality_runs
        ORDER BY run_id DESC
        LIMIT 1
        """
    )

    if row is None:
        raise HTTPException(status_code=404, detail="No data quality runs found.")

    return row


@api_v1.get("/runs/diff")
def get_runs_regression_diff(
    base_run_id: int | None = Query(None),
    target_run_id: int | None = Query(None),
) -> dict[str, Any]:
    """Compare two data quality runs and return regressions, resolutions, and deltas."""
    try:
        return get_run_diff(base_run_id=base_run_id, target_run_id=target_run_id)
    except Exception as exc:
        logger.exception("Run-to-run diff calculation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute run regression diff: {exc}",
        )


@api_v1.get("/results")
@legacy.get("/results")
def get_results(
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    run_id: int | None = Query(None),
    dataset_name: str | None = Query(None),
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> list[dict[str, Any]]:
    """Return data quality check results with pagination and filters."""

    return _get_results(
        limit=limit,
        offset=offset,
        run_id=run_id,
        dataset_name=dataset_name,
        severity=severity,
        status_filter=status_filter,
    )


@api_v1.get("/results/{run_id}")
@legacy.get("/results/{run_id}")
def get_results_for_run(
    run_id: int,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    dataset_name: str | None = Query(None),
    severity: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> list[dict[str, Any]]:
    """Return data quality check results for one run."""

    return _get_results(
        limit=limit,
        offset=offset,
        run_id=run_id,
        dataset_name=dataset_name,
        severity=severity,
        status_filter=status_filter,
    )


def _get_results(
    limit: int,
    offset: int,
    run_id: int | None = None,
    dataset_name: str | None = None,
    severity: str | None = None,
    status_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Shared query for result list endpoints."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "run_id", run_id)
    _add_filter(conditions, params, "dataset_name", dataset_name)
    _add_filter(conditions, params, "severity", severity)
    _add_filter(conditions, params, "status", status_filter)

    return fetch_all(
        f"""
        SELECT *
        FROM data_quality_results
        {_where_clause(conditions)}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


@api_v1.get("/issues/{run_id}")
@legacy.get("/issues/{run_id}")
def get_issues_for_run(
    run_id: int,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    dataset_name: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Return issue-detail examples for one run."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions = ["run_id = :run_id"]
    params["run_id"] = run_id
    _add_filter(conditions, params, "dataset_name", dataset_name)

    return fetch_all(
        f"""
        SELECT *
        FROM data_quality_issue_details
        {_where_clause(conditions)}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


@api_v1.get("/alerts")
@legacy.get("/alerts")
def get_alerts(
    request: Request,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    run_id: int | None = Query(None),
    severity: str | None = Query(None),
    is_resolved: bool | None = Query(None),
) -> list[dict[str, Any]]:
    """Return alerts with pagination and operational filters."""

    identity = _api_identity(request)
    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "run_id", run_id)
    _add_filter(conditions, params, "severity", severity)
    _add_bool_filter(conditions, params, "is_resolved", is_resolved)
    assigned_to = _assigned_alert_scope(identity)
    if assigned_to:
        _add_filter(conditions, params, "assigned_to", assigned_to)

    rows = fetch_all(
        f"""
        SELECT *
        FROM data_quality_alerts
        {_where_clause(conditions)}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )
    log_audit_event(
        "API_READ_ALERTS",
        username=identity["username"],
        role=identity["role"],
        entity_type="alert",
        new_value={
            "row_count": len(rows),
            "run_id": run_id,
            "severity": severity,
            "is_resolved": is_resolved,
            "limit": limit,
            "offset": offset,
        },
        ip_address=_client_ip(request),
    )
    return rows


@api_v1.patch("/alerts/{alert_id}/resolve")
@legacy.patch("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, request: Request) -> dict[str, Any]:
    """Mark one alert as resolved."""

    identity = _api_identity(request)
    _require_alert_mutation(identity)
    _ensure_alert_access(alert_id, identity)
    row = _update_alert_and_return(
        """
        UPDATE data_quality_alerts
        SET
            is_resolved = TRUE,
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = :username,
            escalation_status = COALESCE(escalation_status, 'RESOLVED'),
            resolution_notes = TRIM(BOTH ' ' FROM CONCAT(COALESCE(resolution_notes, ''), ' Resolved from API.'))
        WHERE id = :alert_id
        RETURNING *
        """,
        {"alert_id": alert_id, "username": identity["username"]},
    )

    log_audit_event(
        "API_ALERT_RESOLVED",
        username=identity["username"],
        role=identity["role"],
        entity_type="alert",
        entity_id=alert_id,
        new_value={"is_resolved": True},
        ip_address=_client_ip(request),
    )

    return row


@api_v1.patch("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, request: Request) -> dict[str, Any]:
    """Acknowledge one alert for operational triage."""

    identity = _api_identity(request)
    _require_alert_mutation(identity)
    _ensure_alert_access(alert_id, identity)
    row = _update_alert_and_return(
        """
        UPDATE data_quality_alerts
        SET
            escalation_status = 'ACKNOWLEDGED',
            assigned_to = COALESCE(NULLIF(assigned_to, ''), :username),
            resolution_notes = TRIM(BOTH ' ' FROM CONCAT(COALESCE(resolution_notes, ''), ' Acknowledged by ', :username, '.'))
        WHERE id = :alert_id
        RETURNING *
        """,
        {"alert_id": alert_id, "username": identity["username"]},
    )
    log_audit_event(
        "API_ALERT_ACKNOWLEDGED",
        username=identity["username"],
        role=identity["role"],
        entity_type="alert",
        entity_id=alert_id,
        new_value={"escalation_status": "ACKNOWLEDGED"},
        ip_address=_client_ip(request),
    )
    return row


@api_v1.patch("/alerts/{alert_id}/assign")
def assign_alert(alert_id: int, payload: dict[str, Any], request: Request) -> dict[str, Any]:
    """Assign one alert to a user."""

    identity = _api_identity(request)
    _require_admin(identity)
    assigned_to = str(payload.get("assigned_to") or identity["username"]).strip()
    if not assigned_to:
        raise HTTPException(status_code=400, detail="assigned_to is required.")

    row = _update_alert_and_return(
        """
        UPDATE data_quality_alerts
        SET
            assigned_to = :assigned_to,
            escalation_status = COALESCE(escalation_status, 'ASSIGNED'),
            resolution_notes = TRIM(BOTH ' ' FROM CONCAT(COALESCE(resolution_notes, ''), ' Assigned to ', :assigned_to, '.'))
        WHERE id = :alert_id
        RETURNING *
        """,
        {"alert_id": alert_id, "assigned_to": assigned_to},
    )
    log_audit_event(
        "API_ALERT_ASSIGNED",
        username=identity["username"],
        role=identity["role"],
        entity_type="alert",
        entity_id=alert_id,
        new_value={"assigned_to": assigned_to},
        ip_address=_client_ip(request),
    )
    return row


@api_v1.patch("/alerts/{alert_id}/escalate")
def escalate_alert(alert_id: int, request: Request) -> dict[str, Any]:
    """Escalate one alert immediately."""

    identity = _api_identity(request)
    _require_alert_mutation(identity)
    _ensure_alert_access(alert_id, identity)
    row = _update_alert_and_return(
        """
        UPDATE data_quality_alerts
        SET
            escalation_status = 'ESCALATED',
            escalated_at = CURRENT_TIMESTAMP,
            escalation_level = COALESCE(escalation_level, 0) + 1,
            resolution_notes = TRIM(BOTH ' ' FROM CONCAT(COALESCE(resolution_notes, ''), ' Escalated by ', :username, '.'))
        WHERE id = :alert_id
        RETURNING *
        """,
        {"alert_id": alert_id, "username": identity["username"]},
    )
    log_audit_event(
        "API_ALERT_ESCALATED",
        username=identity["username"],
        role=identity["role"],
        entity_type="alert",
        entity_id=alert_id,
        new_value={"escalation_status": "ESCALATED"},
        ip_address=_client_ip(request),
    )
    return row


def _update_alert_and_return(query: str, params: dict[str, Any]) -> dict[str, Any]:
    """Run an alert update and return the updated alert row."""

    try:
        engine = create_monitor_engine()
        with engine.begin() as connection:
            _ensure_alert_workflow_columns(connection)
            row = connection.execute(text(query), params).mappings().one_or_none()
    except SQLAlchemyError:
        logger.exception("Alert workflow update failed.")
        raise _database_unavailable_error()

    if row is None:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return jsonable_encoder(dict(row))


def _ensure_alert_workflow_columns(connection) -> None:
    """Ensure alert workflow columns exist before operational updates."""

    for statement in [
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255)",
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS resolution_notes TEXT",
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)",
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP",
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS escalation_status VARCHAR(50)",
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP",
        "ALTER TABLE IF EXISTS data_quality_alerts ADD COLUMN IF NOT EXISTS escalation_level INT",
    ]:
        connection.execute(text(statement))


@api_v1.get("/sla")
def get_sla_results(
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    run_id: int | None = Query(None),
    dataset_name: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> list[dict[str, Any]]:
    """Return SLA tracking results."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "run_id", run_id)
    _add_filter(conditions, params, "dataset_name", dataset_name)
    _add_filter(conditions, params, "sla_status", status_filter, "status")

    return fetch_all(
        f"""
        SELECT *
        FROM data_quality_sla_results
        {_where_clause(conditions)}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


@api_v1.get("/lineage")
def get_lineage_edges(
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    source_table: str | None = Query(None),
    target_table: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Return persisted lineage edges."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "source_table", source_table)
    _add_filter(conditions, params, "target_table", target_table)

    return fetch_all(
        f"""
        SELECT *
        FROM data_lineage_edges
        {_where_clause(conditions)}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


@api_v1.get("/profiling")
def get_profiling_results(
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    run_id: int | None = Query(None),
    dataset_name: str | None = Query(None),
    column_name: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Return column-level data profiling results."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "run_id", run_id)
    _add_filter(conditions, params, "dataset_name", dataset_name)
    _add_filter(conditions, params, "column_name", column_name)

    return fetch_all(
        f"""
        SELECT *
        FROM data_profile_results
        {_where_clause(conditions)}
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


def _active_database() -> str:
    """Return active source database name from environment or config."""
    from data_sources.postgres_connector import get_source_db_config
    try:
        return get_source_db_config().database or "my_store_db"
    except Exception:
        return "my_store_db"


@api_v1.get("/rules")
def get_rules_catalog() -> list[dict[str, Any]]:
    """Return active database rules flattened for UI display from PostgreSQL."""

    try:
        db_name = _active_database()
        return get_flat_rules_for_database(db_name)
    except Exception:
        logger.exception("Rules catalog API request failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load rules from metadata database.",
        )


@api_v1.get("/rules/raw")
def get_raw_rules() -> dict[str, Any]:
    """Return raw structured rules for active database from PostgreSQL."""
    try:
        db_name = _active_database()
        return get_rules_for_database(db_name)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read database rules: {exc}",
        )


@api_v1.post("/rules/save")
def save_rules(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    """Save updated rules dictionary into PostgreSQL dataguard_metadata."""
    try:
        db_name = _active_database()
        identity = get_request_identity(request)
        username = identity.get("username") or "admin"
        save_all_rules_in_db(db_name, payload, username=username)
        return {"success": True, "database": db_name, "message": "Rules updated successfully in database."}
    except Exception as exc:
        logger.exception("Failed to save rules in database: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save rules in database: {exc}",
        )


@api_v1.post("/rules/table/{table_name}")
def save_table_rules(table_name: str, payload: dict[str, Any], request: Request) -> dict[str, Any]:
    """Save or update rules for a specific table in PostgreSQL."""
    try:
        db_name = _active_database()
        identity = get_request_identity(request)
        username = identity.get("username") or "admin"
        save_table_rules_in_db(db_name, table_name, payload, username=username)
        return {"success": True, "database": db_name, "table": table_name}
    except Exception as exc:
        logger.exception("Failed to update rules for table %s in DB: %s", table_name, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update rules for table {table_name}: {exc}",
        )


@api_v1.delete("/rules/table/{table_name}")
def delete_table_rules_endpoint(table_name: str, request: Request) -> dict[str, Any]:
    """Delete all rules for a specific table from PostgreSQL."""
    try:
        db_name = _active_database()
        delete_table_rules_from_db(db_name, table_name)
        return {"success": True, "message": f"Rules for table {table_name} deleted from database."}
    except Exception as exc:
        logger.exception("Failed to delete rules for table %s: %s", table_name, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete rules for table {table_name}: {exc}",
        )


@api_v1.post("/rules/table/{table_name}/dry-run")
def dry_run_table_rules_endpoint(table_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Run draft quality rules against live table data without saving them."""
    try:
        return dry_run_table_rules(table_name, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Dry run failed for table %s: %s", table_name, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dry run failed for table {table_name}: {exc}",
        )


@api_v1.post("/rules/infer")
def infer_rules_endpoint(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Scan live database tables to propose data-aware rules with confidence scores."""
    try:
        db_name = _active_database()
        table_name = (payload or {}).get("table_name")
        return infer_smart_rules(db_name, target_table=table_name)
    except Exception as exc:
        logger.exception("Smart rule inference failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Smart rule inference failed: {exc}",
        )


@api_v1.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    event_type: str | None = Query(None),
    username: str | None = Query(None),
    entity_type: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Return enterprise audit log events."""

    params: dict[str, Any] = _pagination_params(limit, offset)
    conditions: list[str] = []
    _add_filter(conditions, params, "event_type", event_type)
    _add_filter(conditions, params, "username", username)
    _add_filter(conditions, params, "entity_type", entity_type)

    return fetch_all(
        f"""
        SELECT *
        FROM audit_logs
        {_where_clause(conditions)}
        ORDER BY created_at DESC, id DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )


@api_v1.post("/checks/run")
def run_checks_now(request: Request) -> dict[str, Any]:
    """Run the data quality pipeline from the API."""

    db_name = _active_database()
    rules = get_rules_for_database(db_name)
    ignored_sections = {"global_rules", "cross_table_validations", "quality_thresholds"}
    dataset_rules = {
        k: v for k, v in rules.items()
        if k not in ignored_sections and isinstance(v, dict) and any(v.values())
    }
    if not dataset_rules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No data quality rules have been configured for database '{db_name}'. Please create rules in the Rules Studio before running checks.",
        )

    try:
        result = run_checks_subprocess(PROJECT_ROOT)
    except subprocess.TimeoutExpired:
        logger.exception("API-triggered check run timed out.")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Data quality checks timed out before completion.",
        )
    except Exception:
        logger.exception("API-triggered check run failed to start.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Data quality checks could not be started.",
        )

    log_audit_event(
        "CHECKS_TRIGGERED_FROM_API",
        username="api_client",
        role="api",
        entity_type="data_quality_run",
        new_value={"success": result.get("success"), "returncode": result.get("returncode")},
        ip_address=_client_ip(request),
    )

    if not result.get("success"):
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=result)

    return result


class ScheduleUpdateRequest(BaseModel):
    enabled: bool
    interval_minutes: int = Field(60, ge=1, le=10080)


@api_v1.get("/scheduler")
def get_scheduler_status() -> dict[str, Any]:
    """Get the current background scheduler status and configuration."""
    from services.scheduler_service import get_schedule_config
    db_name = _active_database()
    return get_schedule_config(db_name)


@api_v1.post("/scheduler")
def update_scheduler_settings(payload: ScheduleUpdateRequest) -> dict[str, Any]:
    """Update background schedule settings (frequency, enabled state)."""
    from services.scheduler_service import update_schedule_config
    db_name = _active_database()
    return update_schedule_config(
        database_name=db_name,
        enabled=payload.enabled,
        interval_minutes=payload.interval_minutes,
    )


@api_v1.post("/scheduler/run-now")
def trigger_immediate_scheduled_run() -> dict[str, Any]:
    """Trigger a scheduled run immediately in background."""
    from services.scheduler_service import execute_scheduled_run
    db_name = _active_database()
    return execute_scheduled_run(db_name)


app.include_router(remediation_router)
app.include_router(users_router)
app.include_router(database_router)
app.include_router(api_v1)
app.include_router(legacy)
