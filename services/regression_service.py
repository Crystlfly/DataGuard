"""Run-to-run regression diff service for tracking what changed between quality runs."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text

from data_sources.postgres_connector import create_monitor_engine
from utils.logger import get_logger

logger = get_logger(__name__)


def _check_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    """Return a canonical check identity key across runs."""
    return (
        str(row.get("dataset_name") or ""),
        str(row.get("check_type") or ""),
        str(row.get("column_name") or ""),
        str(row.get("rule") or ""),
    )


def _serialize_run(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    out = dict(row)
    if out.get("run_time") is not None:
        out["run_time"] = out["run_time"].isoformat()
    return out


def get_run_diff(
    base_run_id: int | None = None,
    target_run_id: int | None = None,
) -> dict[str, Any]:
    """Compare two data quality runs and return regressions, resolutions, and deltas."""
    engine = create_monitor_engine()

    with engine.connect() as conn:
        runs = [
            dict(r)
            for r in conn.execute(
                text("SELECT * FROM data_quality_runs ORDER BY run_id DESC LIMIT 50")
            ).mappings().all()
        ]

        if not runs:
            return {
                "has_runs": False,
                "available_runs": [],
                "base_run": None,
                "target_run": None,
                "verdict": "NO_RUNS",
                "summary_delta": {},
                "new_regressions": [],
                "newly_resolved": [],
                "persistent_failures": [],
                "unchanged_passes": 0,
            }

        runs_by_id = {int(r["run_id"]): r for r in runs}

        if target_run_id is not None and target_run_id in runs_by_id:
            target_run = runs_by_id[target_run_id]
        else:
            target_run = runs[0]
            target_run_id = int(target_run["run_id"])

        if base_run_id is not None and base_run_id in runs_by_id:
            base_run = runs_by_id[base_run_id]
        else:
            older_runs = [r for r in runs if int(r["run_id"]) < int(target_run["run_id"])]
            base_run = older_runs[0] if older_runs else None
            base_run_id = int(base_run["run_id"]) if base_run else None

        target_results = [
            dict(r)
            for r in conn.execute(
                text("SELECT * FROM data_quality_results WHERE run_id = :rid ORDER BY id"),
                {"rid": target_run_id},
            ).mappings().all()
        ]

        target_details_rows = [
            dict(r)
            for r in conn.execute(
                text("SELECT * FROM data_quality_issue_details WHERE run_id = :rid ORDER BY id"),
                {"rid": target_run_id},
            ).mappings().all()
        ]

        base_results: list[dict[str, Any]] = []
        if base_run_id is not None:
            base_results = [
                dict(r)
                for r in conn.execute(
                    text("SELECT * FROM data_quality_results WHERE run_id = :rid ORDER BY id"),
                    {"rid": base_run_id},
                ).mappings().all()
            ]

    details_by_result_id: dict[int, list[dict[str, Any]]] = {}
    for d in target_details_rows:
        rid = int(d.get("result_id") or 0)
        details_by_result_id.setdefault(rid, []).append({
            "row_identifier": str(d.get("row_identifier") or ""),
            "bad_value": str(d.get("bad_value") or ""),
            "reason": str(d.get("reason") or ""),
        })

    base_map = {_check_key(r): r for r in base_results}
    target_map = {_check_key(r): r for r in target_results}

    new_regressions: list[dict[str, Any]] = []
    newly_resolved: list[dict[str, Any]] = []
    persistent_failures: list[dict[str, Any]] = []
    unchanged_passes = 0

    for key, t_row in target_map.items():
        b_row = base_map.get(key)
        t_status = str(t_row.get("status") or "").upper()
        b_status = str(b_row.get("status") or "").upper() if b_row else "NEW"

        t_failed = int(t_row.get("failed_rows") or 0)
        b_failed = int(b_row.get("failed_rows") or 0) if b_row else 0
        t_rate = float(t_row.get("failure_rate") or 0.0)
        b_rate = float(b_row.get("failure_rate") or 0.0) if b_row else 0.0
        examples = details_by_result_id.get(int(t_row.get("id") or 0), [])[:5]

        entry = {
            "dataset_name": t_row.get("dataset_name"),
            "check_type": t_row.get("check_type"),
            "column_name": t_row.get("column_name") or "",
            "rule": str(t_row.get("rule") or ""),
            "severity": t_row.get("severity") or "MEDIUM",
            "base_status": b_status,
            "target_status": t_status,
            "base_failed_rows": b_failed,
            "target_failed_rows": t_failed,
            "failed_rows_delta": t_failed - b_failed,
            "base_failure_rate": b_rate,
            "target_failure_rate": t_rate,
            "failure_rate_delta": round(t_rate - b_rate, 4),
            "total_rows": int(t_row.get("total_rows") or 0),
            "examples": examples,
        }

        if t_status == "FAIL":
            if b_row is None or b_status != "FAIL":
                new_regressions.append(entry)
            else:
                persistent_failures.append(entry)
        elif t_status == "PASS":
            if b_row is not None and b_status == "FAIL":
                newly_resolved.append(entry)
            else:
                unchanged_passes += 1

    # Summary Deltas
    t_score = float(target_run.get("quality_score") or 0.0)
    b_score = float(base_run.get("quality_score") or 0.0) if base_run else t_score
    score_delta = round(t_score - b_score, 2) if base_run else 0.0

    t_failed_cnt = int(target_run.get("failed_checks") or 0)
    b_failed_cnt = int(base_run.get("failed_checks") or 0) if base_run else t_failed_cnt

    t_passed_cnt = int(target_run.get("passed_checks") or 0)
    b_passed_cnt = int(base_run.get("passed_checks") or 0) if base_run else t_passed_cnt

    t_crit_cnt = int(target_run.get("critical_checks") or 0)
    b_crit_cnt = int(base_run.get("critical_checks") or 0) if base_run else t_crit_cnt

    if base_run is None:
        verdict = "BASELINE_ONLY"
    elif new_regressions or score_delta < -0.5:
        verdict = "DEGRADED"
    elif newly_resolved or score_delta > 0.5:
        verdict = "IMPROVED"
    else:
        verdict = "STABLE"

    return {
        "has_runs": True,
        "available_runs": [_serialize_run(r) for r in runs],
        "base_run": _serialize_run(base_run),
        "target_run": _serialize_run(target_run),
        "verdict": verdict,
        "summary_delta": {
            "quality_score_delta": score_delta,
            "failed_checks_delta": t_failed_cnt - b_failed_cnt,
            "passed_checks_delta": t_passed_cnt - b_passed_cnt,
            "critical_checks_delta": t_crit_cnt - b_crit_cnt,
        },
        "new_regressions": new_regressions,
        "newly_resolved": newly_resolved,
        "persistent_failures": persistent_failures,
        "unchanged_passes": unchanged_passes,
    }
