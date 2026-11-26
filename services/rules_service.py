"""Database-backed Quality Rules Service for DataGuard.

Stores and queries data quality assertions from dataguard_metadata.data_quality_rules,
providing multi-database isolation and keeping application source code clean and stateless.
"""

from __future__ import annotations

import json
from typing import Any
from sqlalchemy import text

from data_sources.postgres_connector import create_monitor_engine
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
