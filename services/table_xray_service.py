"""Live Spreadsheet X-Ray and Inline Cell Editing service for DataGuard."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from sqlalchemy import inspect, text

from checks.rule_engine import (
    FORMAT_PATTERNS,
    _build_range_failure_mask,
    safe_text,
)
from config.settings import get_source_db_config
from data_sources.postgres_connector import (
    _quote_identifier,
    _validate_identifier,
    create_monitor_engine,
    create_source_engine,
    load_table,
)
from services.data_cleaning_service import (
    get_cleanable_issues,
    parse_row_identifier,
    update_issue_status,
)
from services.rules_service import INTERNAL_PREFIXES, get_rules_for_database
from utils.audit_logger import log_audit_event
from utils.logger import get_logger

logger = get_logger(__name__)


def _serialize_cell(value: Any) -> Any:
    """Convert DataFrame / SQLAlchemy cell values into JSON-safe primitives."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float, bool, str)):
        return value
    return str(value)


def _evaluate_cell_defects_for_df(
    df: pd.DataFrame,
    table_name: str,
    table_rules: dict[str, Any],
) -> dict[int, dict[str, list[dict[str, Any]]]]:
    """Evaluate active table rules on every row in df, returning defects per row index and column."""
    defects_by_idx: dict[int, dict[str, list[dict[str, Any]]]] = {}
    if df.empty or not table_rules:
        return defects_by_idx

    def add_defect(idx: int, col: str, check_type: str, rule: str, severity: str, reason: str) -> None:
        defects_by_idx.setdefault(idx, {}).setdefault(col, []).append({
            "check_type": check_type,
            "rule": rule,
            "severity": severity,
            "reason": reason,
        })

    # 1. Not Null
    for col in table_rules.get("not_null_columns") or []:
        if col in df.columns:
            mask = df[col].isnull()
            for idx in df.index[mask]:
                add_defect(idx, col, "not_null_check", "not_null", "HIGH", f"'{col}' must not be NULL.")

    # 2. Unique
    for col in table_rules.get("unique_columns") or []:
        if col in df.columns:
            mask = df[col].duplicated(keep=False) & df[col].notnull()
            for idx in df.index[mask]:
                add_defect(idx, col, "unique_check", "unique", "HIGH", f"Duplicate value in unique column '{col}'.")

    # 3. Format checks
    for col, fmt_type in (table_rules.get("format_checks") or {}).items():
        if col in df.columns and fmt_type in FORMAT_PATTERNS:
            pattern = FORMAT_PATTERNS[fmt_type]
            non_null = df[df[col].notnull()]
            bad_mask = ~non_null[col].astype(str).str.match(pattern, na=False)
            for idx in non_null.index[bad_mask]:
                add_defect(idx, col, "format_check", str(fmt_type), "MEDIUM", f"'{col}' must match format: {fmt_type}.")

    # 4. Range checks
    for col, r_cfg in (table_rules.get("range_checks") or {}).items():
        if col in df.columns and isinstance(r_cfg, dict):
            failed_mask, reasons = _build_range_failure_mask(df, col, r_cfg)
            reason_txt = f"{col} failed range rule: {', '.join(reasons)}."
            for idx in df.index[failed_mask]:
                add_defect(idx, col, "range_check", str(r_cfg), "MEDIUM", reason_txt)

    # 5. Categorical checks
    for col, c_cfg in (table_rules.get("categorical_checks") or {}).items():
        if col in df.columns and isinstance(c_cfg, dict):
            allowed = c_cfg.get("allowed_values") or []
            mask = df[col].notnull() & ~df[col].isin(allowed)
            for idx in df.index[mask]:
                add_defect(idx, col, "categorical_check", f"allowed:{allowed}", "MEDIUM", f"'{col}' must be one of: {allowed}.")

    # 6. Referential integrity
    for col, ref_cfg in (table_rules.get("referential_integrity") or {}).items():
        if col in df.columns and isinstance(ref_cfg, dict):
            f_tbl = ref_cfg.get("foreign_table")
            f_col = ref_cfg.get("foreign_column")
            if f_tbl and f_col:
                try:
                    f_df = load_table(f_tbl)
                    if f_col in f_df.columns:
                        valid_vals = set(f_df[f_col].dropna().tolist())
                        non_null = df[df[col].notnull()]
                        bad_mask = ~non_null[col].isin(valid_vals)
                        for idx in non_null.index[bad_mask]:
                            add_defect(idx, col, "referential_integrity_check", f"FK -> {f_tbl}.{f_col}", "CRITICAL", f"Value not found in {f_tbl}.{f_col}.")
                except Exception:
                    pass

    return defects_by_idx


def _match_pk_tuple(row: pd.Series, pk_cols: list[str]) -> dict[str, Any]:
    return {col: _serialize_cell(row[col]) for col in pk_cols if col in row.index}


def _row_matches_predicates(row: pd.Series, predicates: dict[str, Any]) -> bool:
    if not predicates:
        return False
    for col, val in predicates.items():
        if col not in row.index:
            return False
        cell_val = row[col]
        if safe_text(cell_val) != str(val):
            return False
    return True


def get_table_xray(
    table_name: str,
    run_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    defects_only: bool = False,
) -> dict[str, Any]:
    """Load live table grid enriched with cell-level defect markers and open issue IDs."""
    validated_table = _validate_identifier(table_name, "table name")
    source_engine = create_source_engine()
    inspector = inspect(source_engine)

    all_tables = [
        t for t in inspector.get_table_names()
        if not t.startswith(INTERNAL_PREFIXES)
    ]
    if validated_table not in all_tables:
        raise ValueError(f"Table '{validated_table}' not found in active database.")

    cols_meta = inspector.get_columns(validated_table)
    pk_info = inspector.get_pk_constraint(validated_table) or {}
    pk_cols = pk_info.get("constrained_columns") or []

    # Fallback row ID column if table lacks explicit PK
    if not pk_cols:
        for candidate in ("id", f"{validated_table.rstrip('s')}_id"):
            if any(c["name"] == candidate for c in cols_meta):
                pk_cols = [candidate]
                break

    columns = [
        {
            "name": c["name"],
            "data_type": str(c["type"]),
            "nullable": bool(c.get("nullable", True)),
            "is_primary_key": c["name"] in pk_cols,
        }
        for c in cols_meta
    ]

    df = load_table(validated_table)
    if pk_cols and pk_cols[0] in df.columns:
        df = df.sort_values(by=pk_cols, kind="stable").reset_index(drop=True)

    # Evaluate active DB rules directly on the live DataFrame
    db_name = get_source_db_config().database
    all_rules = get_rules_for_database(db_name)
    table_rules = all_rules.get(validated_table) or {}
    live_defects = _evaluate_cell_defects_for_df(df, validated_table, table_rules)

    # Enrich with latest tracked OPEN issues from data_quality_issue_details
    if run_id is None:
        mon_engine = create_monitor_engine()
        with mon_engine.connect() as conn:
            latest_row = conn.execute(
                text("SELECT run_id FROM data_quality_runs ORDER BY run_id DESC LIMIT 1")
            ).scalar()
            run_id = int(latest_row) if latest_row is not None else None

    open_issues = (
        get_cleanable_issues(run_id=run_id, dataset_name=validated_table, status="OPEN")
        if run_id is not None
        else []
    )
    parsed_open_issues = [
        (issue, parse_row_identifier(str(issue.get("row_identifier") or "")))
        for issue in open_issues
    ]

    grid_rows: list[dict[str, Any]] = []
    total_defective_cells = 0

    for idx, row in df.iterrows():
        cell_issues: dict[str, list[dict[str, Any]]] = {}

        # 1. Live rule evaluations
        for col_name, col_defects in (live_defects.get(idx) or {}).items():
            cell_issues[col_name] = list(col_defects)

        # 2. Match open tracked checklist issue IDs (so inline edit auto-resolves them)
        for issue, preds in parsed_open_issues:
            col_name = str(issue.get("column_name") or "")
            if not col_name or col_name not in df.columns:
                continue
            if _row_matches_predicates(row, preds):
                existing = cell_issues.get(col_name) or []
                matched = False
                for d in existing:
                    if d["check_type"] == issue.get("check_type"):
                        d["issue_id"] = int(issue["id"])
                        matched = True
                if not matched and existing:
                    existing[0]["issue_id"] = int(issue["id"])
                elif not existing:
                    # Only include tracked issue if live rule check didn't catch it (or different check like anomaly)
                    cell_issues[col_name] = [{
                        "issue_id": int(issue["id"]),
                        "check_type": str(issue.get("check_type") or ""),
                        "rule": str(issue.get("check_type") or ""),
                        "severity": str(issue.get("severity") or "MEDIUM"),
                        "reason": str(issue.get("reason") or ""),
                    }]

        has_defects = len(cell_issues) > 0
        total_defective_cells += sum(len(v) for v in cell_issues.values())

        if defects_only and not has_defects:
            continue

        row_values = {col: _serialize_cell(row[col]) for col in df.columns}
        grid_rows.append({
            "row_index": int(idx),
            "primary_key": _match_pk_tuple(row, pk_cols),
            "values": row_values,
            "cell_issues": cell_issues,
            "has_defects": has_defects,
        })

    total_rows_filtered = len(grid_rows)
    paginated_rows = grid_rows[offset : offset + limit]

    # Table defect counts for table selector pills
    table_summaries: list[dict[str, Any]] = []
    if run_id is not None:
        all_open = get_cleanable_issues(run_id=run_id, status="OPEN")
        open_by_tbl: dict[str, int] = {}
        for item in all_open:
            tbl = str(item.get("dataset_name") or "")
            open_by_tbl[tbl] = open_by_tbl.get(tbl, 0) + 1
        for t in all_tables:
            table_summaries.append({
                "name": t,
                "open_issues": open_by_tbl.get(t, 0),
            })
    else:
        for t in all_tables:
            table_summaries.append({"name": t, "open_issues": 0})

    return {
        "table_name": validated_table,
        "run_id": run_id,
        "total_rows": len(df),
        "filtered_rows": total_rows_filtered,
        "defective_cells": total_defective_cells,
        "primary_key_columns": pk_cols,
        "columns": columns,
        "rows": paginated_rows,
        "tables": table_summaries,
    }


def _coerce_value_for_column(raw_value: Any, col_type: str, nullable: bool) -> Any:
    """Safely convert inline string input to the target PostgreSQL column's Python type."""
    if raw_value is None or (isinstance(raw_value, str) and raw_value.strip().upper() == "NULL"):
        if not nullable:
            raise ValueError("This column does not allow NULL values.")
        return None

    upper_type = col_type.upper()
    str_val = str(raw_value).strip()

    if any(k in upper_type for k in ("INT", "SERIAL")):
        try:
            return int(str_val)
        except ValueError:
            raise ValueError(f"Expected a whole number for {col_type} column (got {raw_value!r}).")

    if any(k in upper_type for k in ("NUMERIC", "DECIMAL", "FLOAT", "DOUBLE", "REAL")):
        try:
            return float(Decimal(str_val))
        except (InvalidOperation, ValueError):
            raise ValueError(f"Expected a valid decimal number for {col_type} column (got {raw_value!r}).")

    if "BOOL" in upper_type:
        low = str_val.lower()
        if low in ("true", "t", "1", "yes"):
            return True
        if low in ("false", "f", "0", "no"):
            return False
        raise ValueError(f"Expected true/false for boolean column (got {raw_value!r}).")

    return str(raw_value)


def update_cell_inline(
    table_name: str,
    primary_key: dict[str, Any],
    column_name: str,
    new_value: Any,
    updated_by: str = "user",
) -> dict[str, Any]:
    """Update a single cell in PostgreSQL from the Spreadsheet X-Ray and re-verify rules."""
    validated_table = _validate_identifier(table_name, "table name")
    validated_col = _validate_identifier(column_name, "column name")
    if not primary_key:
        raise ValueError("A primary key is required to identify the target row safely.")

    source_engine = create_source_engine()
    inspector = inspect(source_engine)
    cols_meta = inspector.get_columns(validated_table)
    col_info = next((c for c in cols_meta if c["name"] == validated_col), None)
    if col_info is None:
        raise ValueError(f"Column '{validated_col}' not found in '{validated_table}'.")

    typed_new_value = _coerce_value_for_column(
        new_value,
        str(col_info["type"]),
        bool(col_info.get("nullable", True)),
    )

    quoted_table = _quote_identifier(validated_table, "table name")
    quoted_col = _quote_identifier(validated_col, "column name")

    where_parts: list[str] = []
    params: dict[str, Any] = {"new_val": typed_new_value}
    for idx, (pk_col, pk_val) in enumerate(primary_key.items()):
        q_pk = _quote_identifier(pk_col, "primary key column")
        p_key = f"pk_{idx}"
        where_parts.append(f"{q_pk} = :{p_key}")
        params[p_key] = pk_val
    where_clause = " AND ".join(where_parts)

    with source_engine.begin() as conn:
        select_sql = text(f"SELECT {quoted_col} FROM {quoted_table} WHERE {where_clause}")
        existing_row = conn.execute(select_sql, {k: v for k, v in params.items() if k != "new_val"}).fetchone()
        if existing_row is None:
            raise ValueError(f"Row {primary_key} not found in '{validated_table}'.")

        old_value = _serialize_cell(existing_row[0])
        update_sql = text(f"UPDATE {quoted_table} SET {quoted_col} = :new_val WHERE {where_clause}")
        conn.execute(update_sql, params)

    log_audit_event(
        "INLINE_CELL_UPDATED",
        username=updated_by,
        role="admin",
        entity_type="source_table_cell",
        entity_id=f"{validated_table}.{validated_col}",
        old_value={"primary_key": primary_key, "value": old_value},
        new_value={"primary_key": primary_key, "value": _serialize_cell(typed_new_value)},
    )

    # Re-evaluate live rules on this row to see if cell now passes all rules
    df = load_table(validated_table)
    db_name = get_source_db_config().database
    table_rules = get_rules_for_database(db_name).get(validated_table) or {}
    defects_map = _evaluate_cell_defects_for_df(df, validated_table, table_rules)

    remaining_defects: list[dict[str, Any]] = []
    for idx, row in df.iterrows():
        if _row_matches_predicates(row, primary_key):
            remaining_defects = (defects_map.get(idx) or {}).get(validated_col) or []
            break

    is_clean_now = len(remaining_defects) == 0

    # Resolve any matching open tracked issues on this cell if now valid
    resolved_issue_ids: list[int] = []
    if is_clean_now:
        open_issues = get_cleanable_issues(dataset_name=validated_table, status="OPEN")
        for issue in open_issues:
            if str(issue.get("column_name") or "") != validated_col:
                continue
            preds = parse_row_identifier(str(issue.get("row_identifier") or ""))
            # Match either full PK or single matching ID value
            pk_match = all(str(primary_key.get(k)) == str(v) for k, v in preds.items() if k in primary_key)
            if preds and pk_match:
                issue_id = int(issue["id"])
                update_issue_status(
                    issue_id=issue_id,
                    status="RESOLVED",
                    updated_by=updated_by,
                    notes=f"Inline spreadsheet edit: changed '{old_value}' -> '{typed_new_value}'. Verified clean.",
                    resolution_type="INLINE_CELL_EDIT_VERIFIED",
                )
                resolved_issue_ids.append(issue_id)

    return {
        "success": True,
        "table_name": validated_table,
        "column_name": validated_col,
        "primary_key": primary_key,
        "old_value": old_value,
        "new_value": _serialize_cell(typed_new_value),
        "is_clean": is_clean_now,
        "remaining_defects": remaining_defects,
        "resolved_issue_ids": resolved_issue_ids,
        "message": (
            f"Updated {validated_col} to '{typed_new_value}' — Verified clean!"
            if is_clean_now
            else f"Updated {validated_col} to '{typed_new_value}', but still violates: {remaining_defects[0]['reason']}"
        ),
    }
