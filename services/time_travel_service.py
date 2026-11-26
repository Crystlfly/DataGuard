"""Time-Travel mutation timeline and Undo/Redo service for PostgreSQL data edits."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import inspect, text

from config.settings import get_source_db_config
from data_sources.postgres_connector import (
    _quote_identifier,
    _validate_identifier,
    create_monitor_engine,
    create_source_engine,
)
from services.data_cleaning_service import update_issue_status
from utils.audit_logger import log_audit_event
from utils.logger import get_logger

logger = get_logger(__name__)


def _wrap_json_val(value: Any) -> str:
    return json.dumps({"v": value})


def _unwrap_json_val(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return raw
    if isinstance(raw, dict) and "v" in raw:
        return raw["v"]
    return raw


def _parse_json_obj(raw: Any) -> Any:
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return raw


def record_time_travel_mutation(
    database_name: str,
    table_name: str,
    column_name: str,
    primary_key: dict[str, Any],
    old_value: Any,
    new_value: Any,
    source: str = "INLINE_EDIT",
    changed_by: str = "user",
    resolved_issue_ids: list[int] | None = None,
) -> int | None:
    """Persist an atomic cell edit into data_time_travel_log for Time-Travel & Undo."""
    if not primary_key:
        return None

    engine = create_monitor_engine()
    query = text(
        """
        INSERT INTO data_time_travel_log (
            database_name, table_name, column_name, primary_key,
            old_value, new_value, source, status, changed_by, resolved_issue_ids
        ) VALUES (
            :db_name, :tbl_name, :col_name, CAST(:pk AS jsonb),
            CAST(:old_val AS jsonb), CAST(:new_val AS jsonb), :source, 'APPLIED',
            :changed_by, CAST(:resolved_ids AS jsonb)
        )
        RETURNING id
        """
    )

    with engine.begin() as conn:
        mutation_id = conn.execute(
            query,
            {
                "db_name": database_name,
                "tbl_name": table_name,
                "col_name": column_name,
                "pk": json.dumps(primary_key),
                "old_val": _wrap_json_val(old_value),
                "new_val": _wrap_json_val(new_value),
                "source": source,
                "changed_by": changed_by,
                "resolved_ids": json.dumps(resolved_issue_ids or []),
            },
        ).scalar()

    return int(mutation_id) if mutation_id is not None else None


def _serialize_mutation(row: dict[str, Any]) -> dict[str, Any]:
    pk = _parse_json_obj(row.get("primary_key"))
    old_val = _unwrap_json_val(row.get("old_value"))
    new_val = _unwrap_json_val(row.get("new_value"))
    resolved_ids = _parse_json_obj(row.get("resolved_issue_ids"))
    if not isinstance(resolved_ids, list):
        resolved_ids = []

    return {
        "id": int(row["id"]),
        "database_name": row["database_name"],
        "table_name": row["table_name"],
        "column_name": row["column_name"],
        "primary_key": pk if isinstance(pk, dict) else {},
        "old_value": old_val,
        "new_value": new_val,
        "source": row.get("source") or "INLINE_EDIT",
        "status": row.get("status") or "APPLIED",
        "changed_by": row.get("changed_by") or "user",
        "resolved_issue_ids": resolved_ids,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "reverted_at": row["reverted_at"].isoformat() if row.get("reverted_at") else None,
        "reverted_by": row.get("reverted_by"),
    }


def list_time_travel_history(
    database_name: str | None = None,
    table_name: str | None = None,
    status_filter: str | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    """Return recorded data mutations ordered newest first along with summary metrics."""
    active_db = database_name or get_source_db_config().database
    engine = create_monitor_engine()

    conditions = ["database_name = :db_name"]
    params: dict[str, Any] = {"db_name": active_db, "limit": limit}

    if table_name and table_name != "ALL":
        conditions.append("table_name = :tbl_name")
        params["tbl_name"] = table_name
    if status_filter and status_filter != "ALL":
        conditions.append("status = :status")
        params["status"] = status_filter.upper()

    where_sql = " AND ".join(conditions)

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT *
                FROM data_time_travel_log
                WHERE {where_sql}
                ORDER BY id DESC
                LIMIT :limit
                """
            ),
            params,
        ).mappings().all()

        stats_rows = conn.execute(
            text(
                """
                SELECT status, COUNT(*) AS cnt
                FROM data_time_travel_log
                WHERE database_name = :db_name
                GROUP BY status
                """
            ),
            {"db_name": active_db},
        ).mappings().all()

        tables_rows = conn.execute(
            text(
                """
                SELECT DISTINCT table_name
                FROM data_time_travel_log
                WHERE database_name = :db_name
                ORDER BY table_name
                """
            ),
            {"db_name": active_db},
        ).scalars().all()

    items = [_serialize_mutation(dict(r)) for r in rows]
    counts = {str(r["status"]): int(r["cnt"]) for r in stats_rows}
    applied_count = counts.get("APPLIED", 0)
    reverted_count = counts.get("REVERTED", 0)

    return {
        "database": active_db,
        "total": applied_count + reverted_count,
        "applied_count": applied_count,
        "reverted_count": reverted_count,
        "tables": list(tables_rows),
        "mutations": items,
    }


def _apply_value_to_source(
    table_name: str,
    column_name: str,
    primary_key: dict[str, Any],
    value: Any,
) -> None:
    """Write a serialized cell value back into the live PostgreSQL source table."""
    validated_table = _validate_identifier(table_name, "table name")
    validated_col = _validate_identifier(column_name, "column name")
    if not primary_key:
        raise ValueError("Missing primary key on recorded mutation.")

    source_engine = create_source_engine()
    inspector = inspect(source_engine)
    cols_meta = inspector.get_columns(validated_table)
    if not any(c["name"] == validated_col for c in cols_meta):
        raise ValueError(f"Column '{validated_col}' no longer exists on '{validated_table}'.")

    quoted_table = _quote_identifier(validated_table, "table name")
    quoted_col = _quote_identifier(validated_col, "column name")

    where_parts: list[str] = []
    params: dict[str, Any] = {"target_val": value}
    for idx, (pk_col, pk_val) in enumerate(primary_key.items()):
        q_pk = _quote_identifier(pk_col, "primary key column")
        p_key = f"pk_{idx}"
        where_parts.append(f"{q_pk} = :{p_key}")
        params[p_key] = pk_val
    where_clause = " AND ".join(where_parts)

    with source_engine.begin() as conn:
        result = conn.execute(
            text(f"UPDATE {quoted_table} SET {quoted_col} = :target_val WHERE {where_clause}"),
            params,
        )
        if result.rowcount == 0:
            raise ValueError(f"Row {primary_key} no longer exists in '{validated_table}'.")


def undo_mutation(mutation_id: int, requested_by: str = "user") -> dict[str, Any]:
    """Revert a single APPLIED mutation back to its recorded old_value in PostgreSQL."""
    engine = create_monitor_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM data_time_travel_log WHERE id = :id"),
            {"id": mutation_id},
        ).mappings().first()

    if row is None:
        raise ValueError(f"Time-travel entry #{mutation_id} not found.")

    mutation = _serialize_mutation(dict(row))
    if mutation["status"] == "REVERTED":
        raise ValueError(f"Change #{mutation_id} is already reverted.")

    # Restore exact old value in source DB
    _apply_value_to_source(
        table_name=mutation["table_name"],
        column_name=mutation["column_name"],
        primary_key=mutation["primary_key"],
        value=mutation["old_value"],
    )

    # Mark REVERTED in metadata DB
    with engine.begin() as conn:
        updated_row = conn.execute(
            text(
                """
                UPDATE data_time_travel_log
                SET status = 'REVERTED',
                    reverted_at = CURRENT_TIMESTAMP,
                    reverted_by = :by_user
                WHERE id = :id
                RETURNING *
                """
            ),
            {"id": mutation_id, "by_user": requested_by},
        ).mappings().one()

    # Re-open any checklist issues that had been auto-resolved by this edit
    reopened_issues: list[int] = []
    for issue_id in mutation.get("resolved_issue_ids") or []:
        try:
            update_issue_status(
                issue_id=int(issue_id),
                status="OPEN",
                updated_by=requested_by,
                notes=f"Re-opened automatically because mutation #{mutation_id} was undone.",
                resolution_type="TIME_TRAVEL_UNDO",
            )
            reopened_issues.append(int(issue_id))
        except Exception:
            logger.warning("Could not re-open issue #%s after undo.", issue_id)

    log_audit_event(
        "TIME_TRAVEL_UNDO",
        username=requested_by,
        role="admin",
        entity_type="source_table_cell",
        entity_id=f"{mutation['table_name']}.{mutation['column_name']}",
        old_value={"value": mutation["new_value"], "primary_key": mutation["primary_key"]},
        new_value={"value": mutation["old_value"], "primary_key": mutation["primary_key"]},
    )

    return {
        "success": True,
        "mutation": _serialize_mutation(dict(updated_row)),
        "reopened_issue_ids": reopened_issues,
        "message": (
            f"Undone! Restored {mutation['table_name']}.{mutation['column_name']} "
            f"({mutation['primary_key']}) from '{mutation['new_value']}' back to "
            f"'{mutation['old_value'] if mutation['old_value'] is not None else 'NULL'}'."
        ),
    }


def redo_mutation(mutation_id: int, requested_by: str = "user") -> dict[str, Any]:
    """Re-apply a previously REVERTED mutation back to its new_value in PostgreSQL."""
    engine = create_monitor_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM data_time_travel_log WHERE id = :id"),
            {"id": mutation_id},
        ).mappings().first()

    if row is None:
        raise ValueError(f"Time-travel entry #{mutation_id} not found.")

    mutation = _serialize_mutation(dict(row))
    if mutation["status"] == "APPLIED":
        raise ValueError(f"Change #{mutation_id} is already applied.")

    _apply_value_to_source(
        table_name=mutation["table_name"],
        column_name=mutation["column_name"],
        primary_key=mutation["primary_key"],
        value=mutation["new_value"],
    )

    with engine.begin() as conn:
        updated_row = conn.execute(
            text(
                """
                UPDATE data_time_travel_log
                SET status = 'APPLIED',
                    reverted_at = NULL,
                    reverted_by = NULL
                WHERE id = :id
                RETURNING *
                """
            ),
            {"id": mutation_id},
        ).mappings().one()

    for issue_id in mutation.get("resolved_issue_ids") or []:
        try:
            update_issue_status(
                issue_id=int(issue_id),
                status="RESOLVED",
                updated_by=requested_by,
                notes=f"Re-resolved via Time-Travel Redo of mutation #{mutation_id}.",
                resolution_type="TIME_TRAVEL_REDO",
            )
        except Exception:
            logger.warning("Could not resolve issue #%s after redo.", issue_id)

    log_audit_event(
        "TIME_TRAVEL_REDO",
        username=requested_by,
        role="admin",
        entity_type="source_table_cell",
        entity_id=f"{mutation['table_name']}.{mutation['column_name']}",
        old_value={"value": mutation["old_value"], "primary_key": mutation["primary_key"]},
        new_value={"value": mutation["new_value"], "primary_key": mutation["primary_key"]},
    )

    return {
        "success": True,
        "mutation": _serialize_mutation(dict(updated_row)),
        "message": (
            f"Re-applied {mutation['table_name']}.{mutation['column_name']} "
            f"to '{mutation['new_value'] if mutation['new_value'] is not None else 'NULL'}'."
        ),
    }


def time_travel_to_checkpoint(mutation_id: int, requested_by: str = "user") -> dict[str, Any]:
    """Revert all APPLIED mutations from newest back through `mutation_id` in reverse order."""
    engine = create_monitor_engine()
    with engine.connect() as conn:
        target = conn.execute(
            text("SELECT id, database_name FROM data_time_travel_log WHERE id = :id"),
            {"id": mutation_id},
        ).mappings().first()
        if target is None:
            raise ValueError(f"Checkpoint mutation #{mutation_id} not found.")

        rows_to_revert = conn.execute(
            text(
                """
                SELECT id
                FROM data_time_travel_log
                WHERE database_name = :db_name
                  AND status = 'APPLIED'
                  AND id >= :checkpoint_id
                ORDER BY id DESC
                """
            ),
            {"db_name": target["database_name"], "checkpoint_id": mutation_id},
        ).scalars().all()

    if not rows_to_revert:
        raise ValueError("No applied changes exist at or after this checkpoint.")

    reverted_ids: list[int] = []
    for mid in rows_to_revert:
        undo_mutation(int(mid), requested_by=requested_by)
        reverted_ids.append(int(mid))

    return {
        "success": True,
        "reverted_count": len(reverted_ids),
        "reverted_ids": reverted_ids,
        "message": f"Time-traveled back before Edit #{mutation_id}: cleanly reverted {len(reverted_ids)} database change(s).",
    }
