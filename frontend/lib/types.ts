export type RunSummary = {
  run_id: number
  run_time?: string
  total_checks?: number
  passed_checks?: number
  failed_checks?: number
  critical_checks?: number
  quality_score?: number
  overall_status?: string
}

export type DataQualityRun = RunSummary

export type SchedulerConfig = {
  database_name: string
  enabled: boolean
  interval_minutes: number
  last_run_time?: string | null
  next_run_time?: string | null
  last_run_status?: string | null
  last_run_id?: number | null
  is_running?: boolean
}

export type CheckResult = {
  id?: number
  run_id?: number
  dataset_name?: string
  check_type?: string
  column_name?: string
  column?: string
  rule?: string
  total_rows?: number
  failed_rows?: number
  failure_rate?: number
  status?: string
  severity?: string
  run_time?: string
}

export type DataQualityResult = CheckResult

export type IssueDetail = {
  id?: number
  run_id?: number
  dataset_name?: string
  check_type?: string
  column_name?: string
  row_identifier?: string
  bad_value?: string
  reason?: string
  sample_row?: string
  created_at?: string
}

export type AlertRecord = {
  id: number
  run_id?: number
  alert_type?: string
  severity?: string
  message?: string
  is_resolved?: boolean
  owner_team?: string
  owner_email?: string
  assigned_to?: string
  escalation_status?: string
  escalation_level?: number
  escalated_at?: string
  created_at?: string
  resolved_at?: string
  resolved_by?: string
  resolution_notes?: string
}

export type Alert = AlertRecord

export type ApiResponse<T> = {
  data: T
  error?: string
}

export type SlaResult = {
  id?: number
  run_id?: number
  dataset_name?: string
  actual_quality_score?: number
  minimum_quality_score?: number
  actual_critical_issues?: number
  max_critical_issues?: number
  actual_failed_checks?: number
  max_failed_checks?: number
  sla_status?: string
  reason?: string
  created_at?: string
}

export type LineageEdge = {
  id?: number
  source_table?: string
  source_column?: string
  target_table?: string
  target_column?: string
  relationship_type?: string
  description?: string
}

export type ProfileResult = {
  id?: number
  run_id?: number
  dataset_name?: string
  column_name?: string
  data_type?: string
  total_rows?: number
  null_count?: number
  null_rate?: number
  unique_count?: number
  duplicate_count?: number
  min_value?: string
  max_value?: string
  mean?: number
}

export type RuleCatalogRow = {
  dataset_name?: string
  rule_type?: string
  column_name?: string
  rule_config?: string
  severity?: string
  enabled?: boolean | string
}

export type AuditLog = {
  id?: number
  event_type?: string
  username?: string
  role?: string
  entity_type?: string
  entity_id?: string
  created_at?: string
}

export type CheckRunResponse = {
  success?: boolean
  returncode?: number
  stdout?: string
  stderr?: string
}

export type CleanableIssue = IssueDetail & {
  severity?: string
  issue_status?: string
  assigned_to?: string
  resolution_type?: string
  resolution_notes?: string
  issue_status_updated_at?: string
}

export type CleaningSuggestion = {
  action: string
  risk: "LOW" | "MEDIUM" | "HIGH" | string
  description: string
}

export type CleaningPreviewRow = {
  row_identifier?: string
  old_value?: string | number | null
  new_value?: string | number | null
  will_update?: boolean
}

export type CleaningPreview = {
  issue_id: number
  action: string
  target_table: string
  target_column?: string
  total_rows_targeted: number
  max_rows_per_job: number
  dry_run: boolean
  summary: string
  preview_rows: CleaningPreviewRow[]
}

export type CleaningJob = {
  id: number
  run_id?: number
  dataset_name?: string
  issue_id?: number
  cleaning_action?: string
  target_table?: string
  target_column?: string
  row_identifier?: string
  new_value?: string
  status?: string
  requested_by?: string
  approved_by?: string
  executed_by?: string
  total_rows_targeted?: number
  total_rows_updated?: number
  dry_run?: boolean
  approval_required?: boolean
  created_at?: string
  approved_at?: string
  executed_at?: string
  error_message?: string
  proposed_changes?: ProposedCleaningChange[]
  change_log?: CleaningChangeLog[]
}

export type ProposedCleaningChange = CleaningChangeLog & {
  will_update?: boolean
}

export type CleaningChangeLog = {
  id?: number
  job_id?: number
  dataset_name?: string
  table_name?: string
  column_name?: string
  row_identifier?: string
  old_value?: string
  new_value?: string
  change_reason?: string
  created_at?: string
}

export type CleaningPayload = {
  issue_id: number
  action: string
  target_table: string
  target_column?: string
  row_identifier?: string
  new_value?: string
  parameters?: Record<string, unknown>
}

export type UserRole = "admin" | "analyst" | "data_analyst" | "data_engineer" | "viewer"

export type AppUser = {
  id: number
  username: string
  full_name?: string
  email?: string
  job_title?: string
  department?: string
  phone_number?: string
  role: UserRole | string
  is_active?: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
  last_login_at?: string
  profile_completion_percent?: number
  profile_completed?: boolean
  pending_profile_updates?: ProfileUpdateRequest[]
}

export type LoginResponse = {
  token: string
  user: AppUser
}

export type CreateUserPayload = {
  username: string
  password: string
  full_name?: string
  email?: string
  job_title?: string
  department?: string
  phone_number?: string
  role: UserRole | string
  is_active?: boolean
}

export type UpdateUserPayload = {
  password?: string
  full_name?: string
  email?: string
  job_title?: string
  department?: string
  phone_number?: string
  role?: UserRole | string
  is_active?: boolean
}

export type ProfileUpdateRequest = {
  id: number
  user_id?: number
  username?: string
  requested_changes?: Record<string, string>
  status?: "PENDING" | "APPROVED" | "REJECTED" | string
  submitted_at?: string
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  current_full_name?: string
  current_email?: string
  current_job_title?: string
  current_department?: string
  current_phone_number?: string
  current_role?: string
}

export type ProfileUpdatePayload = {
  full_name?: string
  email?: string
  job_title?: string
  department?: string
  phone_number?: string
}

export type TableSummary = {
  name: string
  row_count?: number | null
  columns_count?: number | null
  is_internal?: boolean
}

export type DatabaseConnectionPayload = {
  source_type: string
  connection_mode: "params" | "uri"
  connection_uri?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  ssl_mode?: string
}

export type DatabaseTestResponse = {
  success: boolean
  latency_ms?: number | null
  database_version?: string | null
  tables_count: number
  tables: TableSummary[]
  message: string
  error?: string | null
}

export type DatabaseStatusResponse = {
  connected: boolean
  source_type: string
  host: string
  port: number
  database: string
  username: string
  latency_ms?: number | null
  tables_count: number
  tables: TableSummary[]
  last_verified?: string | null
  database_version?: string | null
  is_separate_source: boolean
  message?: string | null
}

export type ColumnSummary = {
  name: string
  data_type: string
  nullable: boolean
  is_primary_key: boolean
}

export type ForeignKeySummary = {
  constrained_columns: string[]
  referred_table: string
  referred_columns: string[]
}

export type TableSchema = {
  name: string
  row_count?: number | null
  columns_count?: number | null
  is_internal?: boolean
  columns: ColumnSummary[]
  primary_key: string[]
  foreign_keys: ForeignKeySummary[]
}

export type DatabaseSchemaResponse = {
  database: string
  source_type: string
  tables: TableSchema[]
}

export type TableRuleConfig = {
  required_columns?: string[]
  unique_columns?: string[]
  not_null_columns?: string[]
  format_checks?: Record<string, string>
  range_checks?: Record<string, { min?: number; max?: number; min_length?: number; max_length?: number }>
  categorical_checks?: Record<string, { allowed_values: string[] }>
  referential_integrity?: Record<string, { foreign_table: string; foreign_column: string }>
}
