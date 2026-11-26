"""Database connection management and live testing API routes."""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from api.identity import get_request_identity
from api.security import require_api_token
from config.settings import PROJECT_ROOT, get_source_db_config
from data_sources.source_factory import get_source_type
from data_sources.postgres_connector import reset_engine_cache
from utils.audit_logger import log_audit_event
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(
    prefix="/api/v1/database",
    tags=["database"],
    dependencies=[Depends(require_api_token)],
)

INTERNAL_PREFIXES = (
    "data_quality_",
    "data_cleaning_",
    "data_profile_",
    "data_lineage_",
    "data_schema_",
    "data_volume_",
    "data_issue_",
    "audit_logs",
)


class DatabaseConnectionRequest(BaseModel):
    """Payload to test or establish a database connection."""

    source_type: str = Field(default="postgres", description="Database provider type.")
    connection_mode: str = Field(default="params", description="'params' or 'uri'.")
    connection_uri: str | None = Field(default=None, description="Full connection string URI.")
    host: str | None = Field(default=None, description="Hostname or IP.")
    port: int | None = Field(default=5432, description="Port number.")
    database: str | None = Field(default=None, description="Database or catalog name.")
    username: str | None = Field(default=None, description="Database username.")
    password: str | None = Field(default=None, description="Database password.")
    ssl_mode: str | None = Field(default="prefer", description="SSL mode.")


class TableSummary(BaseModel):
    """Summary of a table detected in the target database."""

    name: str
    row_count: int | None = None
    columns_count: int | None = None
    is_internal: bool = False


class DatabaseTestResponse(BaseModel):
    """Response returned after attempting a test connection."""

    success: bool
    latency_ms: float | None = None
    database_version: str | None = None
    tables_count: int = 0
    tables: list[TableSummary] = []
    message: str
    error: str | None = None


class DatabaseStatusResponse(BaseModel):
    """Response describing the current active source database."""

    connected: bool
    source_type: str
    host: str
    port: int
    database: str
    username: str
    latency_ms: float | None = None
    tables_count: int = 0
    tables: list[TableSummary] = []
    last_verified: str | None = None
    database_version: str | None = None
    is_separate_source: bool = False
    message: str | None = None


def _build_database_url(req: DatabaseConnectionRequest) -> URL:
    """Build a validated SQLAlchemy database URL from connection request."""
    if req.connection_mode == "uri" and req.connection_uri:
        uri = req.connection_uri.strip()
        # Normalise postgres:// -> postgresql+psycopg2://
        if uri.startswith("postgres://"):
            uri = "postgresql+psycopg2://" + uri[len("postgres://"):]
        elif uri.startswith("postgresql://") and not uri.startswith("postgresql+"):
            uri = "postgresql+psycopg2://" + uri[len("postgresql://"):]
        return make_url(uri)

    driver = "postgresql+psycopg2"
    if req.source_type == "redshift":
        driver = "postgresql+psycopg2"

    query_params: dict[str, Any] = {}
    if req.ssl_mode and req.ssl_mode != "disable":
        query_params["sslmode"] = req.ssl_mode

    return URL.create(
        drivername=driver,
        username=req.username or "postgres",
        password=req.password or "",
        host=req.host or "localhost",
        port=req.port or 5432,
        database=req.database or "postgres",
        query=query_params if query_params else None,
    )


def _inspect_database(db_url: URL) -> tuple[float, str, list[TableSummary]]:
    """Connect to the database, measure latency, and extract user tables."""
    start_time = time.perf_counter()
    connect_args = {"connect_timeout": 5}
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    try:
        with engine.connect() as conn:
            # Measure ping latency
            version_res = conn.execute(text("SELECT version();")).scalar()
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            db_version = str(version_res or "Unknown").split("\n")[0]

            # Query user tables
            table_query = text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            raw_tables = [row[0] for row in conn.execute(table_query).fetchall()]

            # Fetch approximate row counts from pg_stat_user_tables
            row_count_map: dict[str, int] = {}
            try:
                stats_query = text("""
                    SELECT relname, n_live_tup
                    FROM pg_stat_user_tables
                    WHERE schemaname = 'public';
                """)
                for relname, live_tup in conn.execute(stats_query).fetchall():
                    row_count_map[relname] = int(live_tup or 0)
            except Exception:
                pass

            inspector = inspect(engine)
            tables: list[TableSummary] = []
            for t_name in raw_tables:
                col_count = None
                try:
                    columns = inspector.get_columns(t_name)
                    col_count = len(columns)
                except Exception:
                    pass

                is_int = any(t_name.startswith(p) for p in INTERNAL_PREFIXES)
                tables.append(
                    TableSummary(
                        name=t_name,
                        row_count=row_count_map.get(t_name),
                        columns_count=col_count,
                        is_internal=is_int,
                    )
                )

            # Sort business tables first, internal tables at the end
            tables.sort(key=lambda t: (t.is_internal, t.name))
            return latency_ms, db_version, tables
    finally:
        engine.dispose()


def _update_env_file(updates: dict[str, str]) -> None:
    """Update or append variables in the backend .env file."""
    env_path = PROJECT_ROOT / ".env"
    lines: list[str] = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    updated_keys = set()
    new_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue

        if "=" in line:
            key, _ = line.split("=", 1)
            key = key.strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}")
                updated_keys.add(key)
                continue

        new_lines.append(line)

    # Append any keys that did not exist
    for key, val in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}")

    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


@router.get("/status", response_model=DatabaseStatusResponse)
def get_database_status() -> DatabaseStatusResponse:
    """Return health, connection details, and tables of the active source database."""
    source_type = get_source_type()
    config = get_source_db_config()

    # Determine if SOURCE_DB_* is explicitly configured separate from default DB_*
    is_separate = bool(os.getenv("SOURCE_DB_HOST") or os.getenv("SOURCE_DB_NAME"))

    db_url = URL.create(
        drivername=config.drivername,
        username=config.username,
        password=config.password,
        host=config.host,
        port=config.port,
        database=config.database,
    )

    try:
        latency_ms, db_version, tables = _inspect_database(db_url)
        return DatabaseStatusResponse(
            connected=True,
            source_type=source_type,
            host=config.host,
            port=config.port,
            database=config.database,
            username=config.username,
            latency_ms=latency_ms,
            tables_count=len(tables),
            tables=tables,
            last_verified=datetime.now(timezone.utc).isoformat(),
            database_version=db_version,
            is_separate_source=is_separate,
            message="Source database is active and reachable.",
        )
    except Exception as exc:
        logger.warning("Active database inspection failed: %s", exc)
        return DatabaseStatusResponse(
            connected=False,
            source_type=source_type,
            host=config.host,
            port=config.port,
            database=config.database,
            username=config.username,
            latency_ms=None,
            tables_count=0,
            tables=[],
            last_verified=datetime.now(timezone.utc).isoformat(),
            database_version=None,
            is_separate_source=is_separate,
            message=f"Connection check failed: {exc}",
        )


@router.post("/test", response_model=DatabaseTestResponse)
def test_database_connection(req: DatabaseConnectionRequest) -> DatabaseTestResponse:
    """Test connecting to target database credentials without persisting changes."""
    try:
        db_url = _build_database_url(req)
        latency_ms, db_version, tables = _inspect_database(db_url)

        user_tables_count = sum(1 for t in tables if not t.is_internal)
        msg = f"Connection verified in {latency_ms}ms. Found {len(tables)} tables ({user_tables_count} user tables)."

        return DatabaseTestResponse(
            success=True,
            latency_ms=latency_ms,
            database_version=db_version,
            tables_count=len(tables),
            tables=tables,
            message=msg,
        )
    except OperationalError as exc:
        err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
        logger.warning("Test database connection failed: %s", err_msg)
        return DatabaseTestResponse(
            success=False,
            message="Could not connect to database. Check hostname, port, and credentials.",
            error=err_msg,
        )
    except Exception as exc:
        logger.exception("Unexpected error testing database connection: %s", exc)
        return DatabaseTestResponse(
            success=False,
            message="Database connection error.",
            error=str(exc),
        )


@router.post("/connect", response_model=DatabaseTestResponse)
def connect_database(
    req: DatabaseConnectionRequest,
    request: Request,
) -> DatabaseTestResponse:
    """Verify, persist, and activate a new source database connection."""
    # 1. Run live test first
    test_result = test_database_connection(req)
    if not test_result.success:
        return test_result

    # 2. Extract settings to persist
    db_url = _build_database_url(req)

    env_updates: dict[str, str] = {
        "SOURCE_DB_TYPE": req.source_type or "postgres",
        "SOURCE_DB_HOST": db_url.host or "localhost",
        "SOURCE_DB_PORT": str(db_url.port or 5432),
        "SOURCE_DB_NAME": db_url.database or "",
        "SOURCE_DB_USER": db_url.username or "",
        "SOURCE_DB_PASSWORD": db_url.password or "",
        "SOURCE_DB_DRIVER": db_url.drivername or "postgresql+psycopg2",
    }

    try:
        # Write to .env
        _update_env_file(env_updates)

        # Update current process environment
        for k, v in env_updates.items():
            os.environ[k] = v

        # Invalidate SQLAlchemy engine cache
        reset_engine_cache()

        # Audit log event
        identity = get_request_identity(request)
        log_audit_event(
            event_type="DATABASE_CONNECTED",
            username=identity.get("username"),
            entity_type="database",
            entity_id=db_url.database,
            new_value={
                "source_type": req.source_type,
                "host": db_url.host,
                "port": db_url.port,
                "database": db_url.database,
                "tables_count": test_result.tables_count,
            },
        )

        test_result.message = (
            f"Successfully connected and activated {db_url.database} on {db_url.host}:{db_url.port} as primary data source."
        )
        return test_result
    except Exception as exc:
        logger.exception("Failed to activate database connection: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Connection succeeded but saving configuration failed: {exc}",
        )
