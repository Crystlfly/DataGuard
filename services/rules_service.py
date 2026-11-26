"""Database-backed Quality Rules Service for DataGuard.

Stores and queries data quality assertions from dataguard_metadata.data_quality_rules,
providing multi-database isolation and keeping application source code clean and stateless.
"""

from __future__ import annotations

import json
import re
from typing import Any
import pandas as pd
from sqlalchemy import inspect, text

from checks.rule_engine import FORMAT_PATTERNS, run_rules_for_dataset
from data_sources.postgres_connector import (
    create_monitor_engine,
    create_source_engine,
    load_table,
)
from reports.quality_score import calculate_quality_score
from utils.logger import get_logger

logger = get_logger(__name__)


def get_rules_for_database(database_name: str) -> dict[str, Any]:
    """Retrieve structured rules dictionary for a given database from PostgreSQL."""
    engine = create_monitor_engine()
    query = text("""
        SELECT table_name, rule_type, column_name, rule_config, severity, is_enabled
        FROM data_quality_rules
        WHERE database_name = :db_name
          AND is_enabled = TRUE
        ORDER BY table_name, rule_type, column_name
    """)

    with engine.connect() as conn:
        rows = conn.execute(query, {"db_name": database_name}).mappings().all()

    rules: dict[str, Any] = {}

    for row in rows:
        table = row["table_name"]
        rule_type = row["rule_type"]
        column = row["column_name"] or ""
        config = row["rule_config"]
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except Exception:
                pass

        if table not in rules:
            rules[table] = {}

        if rule_type in ("required_columns", "not_null_columns", "unique_columns"):
            if rule_type not in rules[table]:
                rules[table][rule_type] = []
            if column and column not in rules[table][rule_type]:
                rules[table][rule_type].append(column)

        elif rule_type == "range_checks":
            if "range_checks" not in rules[table]:
                rules[table]["range_checks"] = {}
            if column:
                rules[table]["range_checks"][column] = config

        elif rule_type == "format_checks":
            if "format_checks" not in rules[table]:
                rules[table]["format_checks"] = {}
            if column:
                fmt_val = config.get("format", config) if isinstance(config, dict) else config
                rules[table]["format_checks"][column] = str(fmt_val)

        elif rule_type == "categorical_checks":
            if "categorical_checks" not in rules[table]:
                rules[table]["categorical_checks"] = {}
            if column:
                rules[table]["categorical_checks"][column] = config

        elif rule_type == "referential_integrity":
            if "referential_integrity" not in rules[table]:
                rules[table]["referential_integrity"] = {}
            if column:
                rules[table]["referential_integrity"][column] = config

        else:
            rules[table][rule_type] = config

    # Always ensure baseline global standards if not explicitly defined
    if "global_rules" not in rules:
        rules["global_rules"] = {
            "row_count": {"min_rows": 1},
            "completeness_threshold": 0.95,
            "duplicate_tolerance": 0.01,
        }
    if "quality_thresholds" not in rules:
        rules["quality_thresholds"] = {
            "critical": 95,
            "warning": 85,
            "acceptable": 75,
        }

    return rules


def get_flat_rules_for_database(database_name: str) -> list[dict[str, Any]]:
    """Retrieve flattened rule rows for TanStack table display in the UI."""
    engine = create_monitor_engine()
    query = text("""
        SELECT id, database_name, table_name, rule_type, column_name, rule_config, severity, is_enabled
        FROM data_quality_rules
        WHERE database_name = :db_name
        ORDER BY table_name, rule_type, column_name
    """)

    with engine.connect() as conn:
        rows = conn.execute(query, {"db_name": database_name}).mappings().all()

    flat_list = []
    for r in rows:
        cfg = r["rule_config"]
        if isinstance(cfg, dict):
            cfg_display = json.dumps(cfg)
        else:
            cfg_display = str(cfg or "")

        flat_list.append({
            "id": r["id"],
            "dataset_name": r["table_name"],
            "rule_type": r["rule_type"],
            "column_name": r["column_name"] or "",
            "rule_config": cfg_display,
            "severity": r["severity"] or "MEDIUM",
            "enabled": bool(r["is_enabled"]),
        })

    return flat_list


def save_table_rules_in_db(
    database_name: str,
    table_name: str,
    table_config: dict[str, Any],
    username: str = "admin",
) -> None:
    """Save or update quality assertions for a single table in PostgreSQL."""
    engine = create_monitor_engine()

    insert_rows: list[dict[str, Any]] = []

    # Required columns
    for col in table_config.get("required_columns", []):
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "required_columns",
            "column_name": str(col),
            "rule_config": json.dumps({"required": True}),
            "severity": "HIGH",
            "created_by": username,
        })

    # Not null columns
    for col in table_config.get("not_null_columns", []):
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "not_null_columns",
            "column_name": str(col),
            "rule_config": json.dumps({"not_null": True}),
            "severity": "HIGH",
            "created_by": username,
        })

    # Unique columns
    for col in table_config.get("unique_columns", []):
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "unique_columns",
            "column_name": str(col),
            "rule_config": json.dumps({"unique": True}),
            "severity": "HIGH",
            "created_by": username,
        })

    # Range checks
    for col, rc in (table_config.get("range_checks") or {}).items():
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "range_checks",
            "column_name": str(col),
            "rule_config": json.dumps(rc),
            "severity": "MEDIUM",
            "created_by": username,
        })

    # Format checks
    for col, fmt in (table_config.get("format_checks") or {}).items():
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "format_checks",
            "column_name": str(col),
            "rule_config": json.dumps({"format": fmt} if isinstance(fmt, str) else fmt),
            "severity": "MEDIUM",
            "created_by": username,
        })

    # Categorical checks
    for col, cat in (table_config.get("categorical_checks") or {}).items():
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "categorical_checks",
            "column_name": str(col),
            "rule_config": json.dumps(cat),
            "severity": "MEDIUM",
            "created_by": username,
        })

    # Referential integrity
    for col, ref in (table_config.get("referential_integrity") or {}).items():
        insert_rows.append({
            "database_name": database_name,
            "table_name": table_name,
            "rule_type": "referential_integrity",
            "column_name": str(col),
            "rule_config": json.dumps(ref),
            "severity": "CRITICAL",
            "created_by": username,
        })

    delete_query = text("""
        DELETE FROM data_quality_rules
        WHERE database_name = :db_name
          AND table_name = :tbl_name
    """)

    insert_query = text("""
        INSERT INTO data_quality_rules (
            database_name, table_name, rule_type, column_name, rule_config, severity, created_by
        ) VALUES (
            :database_name, :table_name, :rule_type, :column_name, CAST(:rule_config AS jsonb), :severity, :created_by
        )
    """)

    with engine.begin() as conn:
        conn.execute(delete_query, {"db_name": database_name, "tbl_name": table_name})
        if insert_rows:
            conn.execute(insert_query, insert_rows)

    logger.info("Saved %s rule(s) for table %s in database %s.", len(insert_rows), table_name, database_name)


def save_all_rules_in_db(
    database_name: str,
    rules_dict: dict[str, Any],
    username: str = "admin",
) -> None:
    """Save or replace quality assertions for all tables under a database."""
    ignored = {"global_rules", "cross_table_validations", "quality_thresholds"}
    tables = [k for k, v in rules_dict.items() if k not in ignored and isinstance(v, dict)]

    for table_name in tables:
        save_table_rules_in_db(database_name, table_name, rules_dict[table_name], username)


def delete_table_rules_from_db(database_name: str, table_name: str) -> None:
    """Delete all assertions for a specific table under a database."""
    engine = create_monitor_engine()
    query = text("""
        DELETE FROM data_quality_rules
        WHERE database_name = :db_name
          AND table_name = :tbl_name
    """)
    with engine.begin() as conn:
        conn.execute(query, {"db_name": database_name, "tbl_name": table_name})
    logger.info("Deleted rules for table %s in database %s.", table_name, database_name)


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


def dry_run_table_rules(table_name: str, table_config: dict[str, Any]) -> dict[str, Any]:
    """Execute draft quality rules against live table data without saving to DB."""
    df = load_table(table_name)
    results = run_rules_for_dataset(df, table_name, table_config or {}, table_loader=load_table)

    scored = [r for r in results if r.get("status") in ("PASS", "FAIL")]
    passed = sum(1 for r in scored if r.get("status") == "PASS")
    failed = sum(1 for r in scored if r.get("status") == "FAIL")
    score = calculate_quality_score(results) if scored else 100.0

    formatted_results = []
    for r in results:
        raw_details = r.get("details") or r.get("issue_details") or []
        examples = [
            {
                "row_identifier": str(d.get("row_identifier", "")),
                "bad_value": str(d.get("bad_value", "")),
                "reason": str(d.get("reason", "")),
            }
            for d in raw_details[:5]
        ]
        reason_str = r.get("reason") or (examples[0]["reason"] if examples else "")
        formatted_results.append({
            "check_type": r.get("check_type"),
            "column_name": r.get("column"),
            "rule": str(r.get("rule") or ""),
            "status": r.get("status"),
            "severity": r.get("severity"),
            "total_rows": int(r.get("total_rows") or 0),
            "failed_rows": int(r.get("failed_rows") or 0),
            "failure_rate": float(r.get("failure_rate") or 0.0),
            "reason": reason_str,
            "examples": examples,
        })

    return {
        "table_name": table_name,
        "row_count": len(df),
        "total_checks": len(scored),
        "passed_checks": passed,
        "failed_checks": failed,
        "estimated_score": score,
        "results": formatted_results,
    }


def _clean_outlier_samples(values: list[Any], limit: int = 3) -> list[str]:
    samples: list[str] = []
    for val in values:
        s = "NULL" if val is None or (isinstance(val, float) and pd.isna(val)) else str(val)
        if s not in samples:
            samples.append(s)
        if len(samples) >= limit:
            break
    return samples


def _infer_table_suggestions(
    table_name: str,
    df: pd.DataFrame,
    pk_cols: list[str],
    fk_list: list[dict[str, Any]],
    all_table_pks: dict[str, list[str]],
    all_tables_dfs: dict[str, pd.DataFrame],
) -> list[dict[str, Any]]:
    """Analyze live column data and schema to infer rule suggestions with confidence."""
    suggestions: list[dict[str, Any]] = []
    total_rows = len(df)
    if total_rows == 0:
        return suggestions

    email_pattern = re.compile(FORMAT_PATTERNS["email"])
    explicit_fk_cols: set[str] = set()

    for fk in fk_list:
        c_cols = fk.get("constrained_columns") or []
        r_tbl = fk.get("referred_table")
        r_cols = fk.get("referred_columns") or []
        if c_cols and r_tbl and r_cols:
            col = c_cols[0]
            explicit_fk_cols.add(col)
            ref_col = r_cols[0]
            ref_df = all_tables_dfs.get(r_tbl)
            matching_rows = total_rows
            failing_rows = 0
            outliers: list[str] = []
            if ref_df is not None and col in df.columns and ref_col in ref_df.columns:
                non_null = df[df[col].notnull()][col]
                valid_set = set(ref_df[ref_col].dropna().tolist())
                bad = non_null[~non_null.isin(valid_set)]
                failing_rows = len(bad)
                matching_rows = len(non_null) - failing_rows
                outliers = _clean_outlier_samples(bad.tolist())
            confidence = round((matching_rows / max(1, total_rows)) * 100)
            suggestions.append({
                "id": f"{table_name}.{col}.referential_integrity",
                "table_name": table_name,
                "column_name": col,
                "rule_type": "referential_integrity",
                "rule_config": {"foreign_table": r_tbl, "foreign_column": ref_col},
                "confidence": max(confidence, 90),
                "matching_rows": int(matching_rows),
                "would_fail_rows": int(failing_rows),
                "sample_outliers": outliers,
                "reason": f"Schema foreign key references {r_tbl}.{ref_col}" + (f" ({failing_rows} orphan row(s) detected)." if failing_rows else " (100% intact)."),
            })

    for col in df.columns:
        series = df[col]
        is_pk = col in pk_cols
        null_count = int(series.isnull().sum())
        non_null = series.dropna()
        non_null_count = len(non_null)

        # 1. Not Null inference
        if is_pk or null_count == 0 or (total_rows >= 5 and (null_count / total_rows) <= 0.20):
            matching = total_rows - null_count
            conf = round((matching / total_rows) * 100)
            suggestions.append({
                "id": f"{table_name}.{col}.not_null_columns",
                "table_name": table_name,
                "column_name": col,
                "rule_type": "not_null_columns",
                "rule_config": {"not_null": True},
                "confidence": conf,
                "matching_rows": int(matching),
                "would_fail_rows": int(null_count),
                "sample_outliers": ["NULL"] if null_count > 0 else [],
                "reason": "Primary key / 100% populated column." if null_count == 0 else f"{conf}% of rows are populated; flags {null_count} NULL row(s).",
            })

        # 2. Unique inference
        if non_null_count > 0:
            dup_count = int(series.duplicated().sum())
            unique_ratio = (total_rows - dup_count) / total_rows
            looks_unique_col = is_pk or any(k in col.lower() for k in ("email", "sku", "code", "slug", "username"))
            if is_pk or (looks_unique_col and total_rows >= 5 and unique_ratio >= 0.85):
                suggestions.append({
                    "id": f"{table_name}.{col}.unique_columns",
                    "table_name": table_name,
                    "column_name": col,
                    "rule_type": "unique_columns",
                    "rule_config": {"unique": True},
                    "confidence": round(unique_ratio * 100),
                    "matching_rows": int(total_rows - dup_count),
                    "would_fail_rows": int(dup_count),
                    "sample_outliers": _clean_outlier_samples(series[series.duplicated(keep=False)].tolist()),
                    "reason": "Primary key uniqueness." if is_pk else f"{round(unique_ratio * 100)}% distinct values; flags {dup_count} duplicate(s).",
                })

        # 3. String / Format / Categorical / Length inference
        is_text = pd.api.types.is_string_dtype(series) or series.dtype == object
        if is_text and non_null_count >= 3:
            str_vals = non_null.astype(str).str.strip()
            # Email format detection from actual data
            email_matches = str_vals.apply(lambda v: bool(email_pattern.match(v)))
            email_match_count = int(email_matches.sum())
            email_rate = email_match_count / non_null_count
            if email_rate >= 0.65:
                bad_emails = str_vals[~email_matches].tolist()
                suggestions.append({
                    "id": f"{table_name}.{col}.format_checks",
                    "table_name": table_name,
                    "column_name": col,
                    "rule_type": "format_checks",
                    "rule_config": {"format": "email"},
                    "confidence": round(email_rate * 100),
                    "matching_rows": int(email_match_count),
                    "would_fail_rows": int(non_null_count - email_match_count),
                    "sample_outliers": _clean_outlier_samples(bad_emails),
                    "reason": f"{round(email_rate * 100)}% of values match email pattern" + (f" (flags {len(bad_emails)} malformed value(s))." if bad_emails else "."),
                })
            else:
                # Categorical inference on low-cardinality non-ID columns
                lower_col = col.lower()
                is_id_or_desc = is_pk or lower_col.endswith("_id") or any(k in lower_col for k in ("email", "desc", "note", "url", "date", "time", "created", "updated", "address", "phone"))
                value_counts = str_vals.value_counts()
                distinct_cnt = len(value_counts)
                if not is_id_or_desc and non_null_count >= 5 and 2 <= distinct_cnt <= 8 and (distinct_cnt / non_null_count) <= 0.50:
                    # Keep dominant recurring values (count >= 2 or >= 10% of rows)
                    dominant = [val for val, cnt in value_counts.items() if cnt >= 2 or (cnt / non_null_count) >= 0.12]
                    if len(dominant) >= 2:
                        matching = int(str_vals.isin(dominant).sum())
                        outliers = str_vals[~str_vals.isin(dominant)].tolist()
                        cov = matching / non_null_count
                        if cov >= 0.75:
                            suggestions.append({
                                "id": f"{table_name}.{col}.categorical_checks",
                                "table_name": table_name,
                                "column_name": col,
                                "rule_type": "categorical_checks",
                                "rule_config": {"allowed_values": dominant},
                                "confidence": round(cov * 100),
                                "matching_rows": matching,
                                "would_fail_rows": len(outliers),
                                "sample_outliers": _clean_outlier_samples(outliers),
                                "reason": f"{round(cov * 100)}% of rows use {len(dominant)} recurring categories ({', '.join(dominant[:4])})" + (f"; flags {len(outliers)} outlier(s)." if outliers else "."),
                            })

                # Min length for names/titles
                if any(k in lower_col for k in ("name", "title")) and non_null_count >= 4:
                    len_ok = str_vals.str.len() >= 2
                    ok_cnt = int(len_ok.sum())
                    rate = ok_cnt / non_null_count
                    if rate >= 0.80 and ok_cnt < non_null_count:
                        short_vals = str_vals[~len_ok].tolist()
                        suggestions.append({
                            "id": f"{table_name}.{col}.range_checks",
                            "table_name": table_name,
                            "column_name": col,
                            "rule_type": "range_checks",
                            "rule_config": {"min_length": 2},
                            "confidence": round(rate * 100),
                            "matching_rows": ok_cnt,
                            "would_fail_rows": len(short_vals),
                            "sample_outliers": _clean_outlier_samples(short_vals),
                            "reason": f"{round(rate * 100)}% of names are >= 2 chars; catches {len(short_vals)} suspiciously short entry.",
                        })

        # 4. Numeric Range Inference
        numeric_series = pd.to_numeric(non_null, errors="coerce").dropna()
        if not is_pk and not col.lower().endswith("_id") and len(numeric_series) >= 3 and len(numeric_series) >= non_null_count * 0.8:
            non_neg = numeric_series >= 0
            non_neg_cnt = int(non_neg.sum())
            non_neg_rate = non_neg_cnt / len(numeric_series)
            if non_neg_rate >= 0.80:
                neg_outliers = numeric_series[~non_neg].tolist()
                suggestions.append({
                    "id": f"{table_name}.{col}.range_checks",
                    "table_name": table_name,
                    "column_name": col,
                    "rule_type": "range_checks",
                    "rule_config": {"min": 0},
                    "confidence": round(non_neg_rate * 100),
                    "matching_rows": non_neg_cnt,
                    "would_fail_rows": len(neg_outliers),
                    "sample_outliers": _clean_outlier_samples(neg_outliers),
                    "reason": f"{round(non_neg_rate * 100)}% of numeric values are >= 0" + (f"; flags {len(neg_outliers)} negative value(s)." if neg_outliers else "."),
                })

        # 5. Implicit Foreign Key inference (when not explicit FK in schema)
        if not is_pk and col not in explicit_fk_cols and col.lower().endswith("_id") and non_null_count >= 3:
            stem = col.lower()[:-3]
            candidate_tables = [t for t in all_table_pks if t.lower() in (stem, f"{stem}s", f"{stem}es")]
            for target_tbl in candidate_tables:
                target_pks = all_table_pks.get(target_tbl) or []
                ref_col = target_pks[0] if target_pks else "id"
                ref_df = all_tables_dfs.get(target_tbl)
                if ref_df is not None and ref_col in ref_df.columns:
                    valid_set = set(ref_df[ref_col].dropna().tolist())
                    bad = non_null[~non_null.isin(valid_set)]
                    match_cnt = non_null_count - len(bad)
                    match_rate = match_cnt / non_null_count
                    if match_rate >= 0.65:
                        suggestions.append({
                            "id": f"{table_name}.{col}.referential_integrity",
                            "table_name": table_name,
                            "column_name": col,
                            "rule_type": "referential_integrity",
                            "rule_config": {"foreign_table": target_tbl, "foreign_column": ref_col},
                            "confidence": round(match_rate * 100),
                            "matching_rows": int(match_cnt),
                            "would_fail_rows": int(len(bad)),
                            "sample_outliers": _clean_outlier_samples(bad.tolist()),
                            "reason": f"{round(match_rate * 100)}% of '{col}' values match {target_tbl}.{ref_col}" + (f" (flags {len(bad)} orphan row(s))." if len(bad) else "."),
                        })

    # Prioritize suggestions that actually catch dirty rows or have 100% confidence cleanly
    suggestions.sort(key=lambda s: (-min(1, s["would_fail_rows"]), -s["confidence"], s["column_name"]))
    return suggestions


def infer_smart_rules(
    database_name: str,
    target_table: str | None = None,
    sample_limit: int = 500,
) -> dict[str, Any]:
    """Scan live database tables to propose data-aware rules with confidence scores."""
    source_engine = create_source_engine()
    inspector = inspect(source_engine)
    all_names = [
        t for t in inspector.get_table_names()
        if not t.startswith(INTERNAL_PREFIXES)
    ]

    all_table_pks: dict[str, list[str]] = {}
    all_tables_dfs: dict[str, pd.DataFrame] = {}
    all_fks: dict[str, list[dict[str, Any]]] = {}

    for tbl in all_names:
        pk_info = inspector.get_pk_constraint(tbl) or {}
        all_table_pks[tbl] = pk_info.get("constrained_columns") or []
        all_fks[tbl] = inspector.get_foreign_keys(tbl) or []
        try:
            df = load_table(tbl)
            all_tables_dfs[tbl] = df.head(sample_limit)
        except Exception:
            all_tables_dfs[tbl] = pd.DataFrame()

    tables_to_scan = [target_table] if target_table and target_table in all_names else all_names
    result_tables: dict[str, Any] = {}
    total_suggestions = 0

    for tbl in tables_to_scan:
        df = all_tables_dfs.get(tbl, pd.DataFrame())
        suggestions = _infer_table_suggestions(
            table_name=tbl,
            df=df,
            pk_cols=all_table_pks.get(tbl, []),
            fk_list=all_fks.get(tbl, []),
            all_table_pks=all_table_pks,
            all_tables_dfs=all_tables_dfs,
        )
        total_suggestions += len(suggestions)
        result_tables[tbl] = {
            "row_count": len(df),
            "suggestions": suggestions,
        }

    return {
        "database": database_name,
        "total_suggestions": total_suggestions,
        "tables": result_tables,
    }
