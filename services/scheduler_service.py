"""Background scheduler service for automated data quality checks."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import text

from config.settings import PROJECT_ROOT
from data_sources.postgres_connector import create_monitor_engine
from services.pipeline_service import run_checks_subprocess
from utils.logger import get_logger

logger = get_logger(__name__)

_scheduler_thread: threading.Thread | None = None
_stop_event = threading.Event()
_is_running_check = False
_lock = threading.Lock()


def get_schedule_config(database_name: str) -> dict[str, Any]:
    """Return the schedule configuration for a given database."""
    engine = create_monitor_engine()
    query = text(
        """
        SELECT database_name, enabled, interval_minutes, last_run_time, 
               next_run_time, last_run_status, last_run_id, updated_at
        FROM data_quality_scheduled_checks
        WHERE database_name = :db_name
        LIMIT 1
        """
    )
    with engine.connect() as conn:
        row = conn.execute(query, {"db_name": database_name}).mappings().first()

    if not row:
        return {
            "database_name": database_name,
            "enabled": False,
            "interval_minutes": 60,
            "last_run_time": None,
            "next_run_time": None,
            "last_run_status": None,
            "last_run_id": None,
            "is_running": _is_running_check,
        }

    return {
        "database_name": row["database_name"],
        "enabled": bool(row["enabled"]),
        "interval_minutes": int(row["interval_minutes"] or 60),
        "last_run_time": row["last_run_time"].isoformat() if row["last_run_time"] else None,
        "next_run_time": row["next_run_time"].isoformat() if row["next_run_time"] else None,
        "last_run_status": row["last_run_status"],
        "last_run_id": row["last_run_id"],
        "is_running": _is_running_check,
    }


def update_schedule_config(
    database_name: str,
    enabled: bool,
    interval_minutes: int = 60,
) -> dict[str, Any]:
    """Save or update the schedule configuration for a given database."""
    engine = create_monitor_engine()
    now = datetime.utcnow()
    next_run = (now + timedelta(minutes=interval_minutes)) if enabled else None

    upsert_sql = text(
        """
        INSERT INTO data_quality_scheduled_checks (
            database_name, enabled, interval_minutes, next_run_time, updated_at
        ) VALUES (
            :db_name, :enabled, :interval, :next_run, :now
        )
        ON CONFLICT (database_name) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            interval_minutes = EXCLUDED.interval_minutes,
            next_run_time = EXCLUDED.next_run_time,
            updated_at = EXCLUDED.updated_at
        """
    )

    with engine.begin() as conn:
        conn.execute(
            upsert_sql,
            {
                "db_name": database_name,
                "enabled": enabled,
                "interval": interval_minutes,
                "next_run": next_run,
                "now": now,
            },
        )

    logger.info(
        "Updated schedule for '%s': enabled=%s, interval=%sm, next_run=%s",
        database_name,
        enabled,
        interval_minutes,
        next_run,
    )
    return get_schedule_config(database_name)


def execute_scheduled_run(database_name: str) -> dict[str, Any]:
    """Execute data quality checks in background and update schedule state."""
    global _is_running_check
    with _lock:
        if _is_running_check:
            logger.warning("Scheduled run skipped: another check run is currently in progress.")
            return {"skipped": True, "reason": "Check run already in progress"}
        _is_running_check = True

    logger.info("Executing scheduled background checks for '%s'.", database_name)
    engine = create_monitor_engine()
    start_time = datetime.utcnow()
    status_label = "FAILED"
    latest_run_id = None

    try:
        result = run_checks_subprocess(PROJECT_ROOT)
        status_label = "SUCCESS" if result.get("success") else "FAILED"
    except Exception:
        logger.exception("Error during scheduled check execution.")
        status_label = "ERROR"
    finally:
        with _lock:
            _is_running_check = False

    try:
        with engine.connect() as conn:
            run_row = conn.execute(
                text("SELECT run_id FROM data_quality_runs ORDER BY run_id DESC LIMIT 1")
            ).mappings().first()
            if run_row:
                latest_run_id = run_row["run_id"]

        config = get_schedule_config(database_name)
        interval = config["interval_minutes"] if config["enabled"] else 60
        next_run = (datetime.utcnow() + timedelta(minutes=interval)) if config["enabled"] else None

        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE data_quality_scheduled_checks
                    SET last_run_time = :last_run,
                        next_run_time = :next_run,
                        last_run_status = :status,
                        last_run_id = :run_id,
                        updated_at = :now
                    WHERE database_name = :db_name
                    """
                ),
                {
                    "last_run": start_time,
                    "next_run": next_run,
                    "status": status_label,
                    "run_id": latest_run_id,
                    "now": datetime.utcnow(),
                    "db_name": database_name,
                },
            )
    except Exception:
        logger.exception("Failed to update schedule status record.")

    return {
        "status": status_label,
        "run_id": latest_run_id,
        "completed_at": datetime.utcnow().isoformat(),
    }


def _scheduler_loop():
    """Background polling loop that checks for due scheduled runs."""
    logger.info("Background checks scheduler started.")
    while not _stop_event.is_set():
        try:
            engine = create_monitor_engine()
            now = datetime.utcnow()
            with engine.connect() as conn:
                due_rows = conn.execute(
                    text(
                        """
                        SELECT database_name, interval_minutes
                        FROM data_quality_scheduled_checks
                        WHERE enabled = TRUE 
                          AND next_run_time IS NOT NULL 
                          AND next_run_time <= :now
                        """
                    ),
                    {"now": now},
                ).mappings().all()

            for row in due_rows:
                db_name = row["database_name"]
                logger.info("Scheduler triggered run for '%s'.", db_name)
                execute_scheduled_run(db_name)
        except Exception:
            logger.exception("Scheduler loop encountered an error.")

        # Sleep in small slices to respond promptly to stop events
        for _ in range(30):
            if _stop_event.is_set():
                break
            time.sleep(1)


def start_scheduler():
    """Start the background scheduler daemon thread if not already running."""
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return

    _stop_event.clear()
    _scheduler_thread = threading.Thread(
        target=_scheduler_loop,
        name="DataGuardScheduler",
        daemon=True,
    )
    _scheduler_thread.start()
    logger.info("DataGuard background scheduler thread initiated.")


def stop_scheduler():
    """Stop the background scheduler daemon thread."""
    global _scheduler_thread
    _stop_event.set()
    if _scheduler_thread and _scheduler_thread.is_alive():
        _scheduler_thread.join(timeout=3)
    _scheduler_thread = None
    logger.info("DataGuard background scheduler stopped.")
