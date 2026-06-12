# GM Script Library Export Schema

**Schema version:** `1.0.0`  
**Owning application:** GM Script Library  
**Platform:** MJW Personal App Platform

This document defines the stable JSON import and export contracts for the GM Script Library. Every JSON export produced by the Export Center includes an explicit `gms_export_schema_version` field so downstream MJW tools can validate compatibility before processing operational data.

## Envelope Contract

All JSON exports use a common top-level envelope. The envelope gives downstream tools enough metadata to identify the producer, schema version, export type, generation timestamp, and canonical payload location.

| Field | Type | Required | Description | Intended Consumers |
| --- | --- | --- | --- | --- |
| `gms_export_schema_version` | string | Required | Semantic schema version for the GM Script Library export contract. Current value is `1.0.0`. | All consumers |
| `version` | string | Required | Backward-compatible alias for the schema version. New integrations should prefer `gms_export_schema_version`. | Legacy room packet readers |
| `sourceApp` | string | Required | Human-readable source application name. Current value is `GM Script Library`. | All consumers |
| `exportType` | string | Required | One of `room_packet`, `staff_acknowledgement_report`, `readiness_audit_report`, `full_backup`, or `integration_packet`. | All consumers |
| `reportType` | string | Optional | Report-oriented alias for integrations that distinguish operational reports from backup packets. | Reporting tools |
| `exportedAt` | ISO 8601 string | Required | Timestamp when the export was generated. | Backup tools, audit logs |
| `generatedFrom` | string | Required | `client_state` for browser-generated exports or `server_backend` for server-side Netlify Function exports. | Production backup and restore tools |
| `producer` | object | Required | Producer metadata containing `app`, `platform`, and `schemaDocumentation`. | All consumers |
| `payload` | object | Required | Canonical export body. | All consumers |

For compatibility with earlier room packet exports, `room_packet` JSON also mirrors the payload fields at the top level. New consumers should use `payload` as the canonical location.

## Export Types

The Export Center produces five stable JSON export types. Each type is designed for a specific operational or integration use case so that other MJW applications can consume only the data they need.

| Export Type | Primary Purpose | Safe for Browser Download | Client-Side Import Support | Intended Downstream Consumers |
| --- | --- | --- | --- | --- |
| `room_packet` | Move or restore one room with scripts, versions, hints, pronunciation terms, acknowledgements, readiness audit, and integration hints. | Yes | Yes | RoomReady Ops, Puzzle Flow Visualizer, Puzzle Dependency Auditor, LockMap Studio, MJW Operator Toolkit |
| `staff_acknowledgement_report` | Export acknowledgement compliance status for managers and training systems. | Yes | No | Staff training dashboards, compliance reporting tools |
| `readiness_audit_report` | Export operational readiness scores, issues, remediation targets, metadata, and room checklists. | Yes | No | RoomReady Ops, management dashboards, QA workflows |
| `full_backup` | Back up the complete application state for controlled restoration or migration. | Yes, with access control | Not in browser; administrator restore only | Backup tooling, migration tooling, production administrators |
| `integration_packet` | Provide compact summaries optimized for MJW ecosystem dashboards. | Yes | No | MJW Operator Toolkit, portfolio-level operations dashboards |

## Room Packet Payload

The `room_packet` payload is the only export type currently supported by the client-side import workflow. Imports validate before modifying data and can be applied through either safe merge or room overwrite mode.

| Field | Type | Required | Description | Notes |
| --- | --- | --- | --- | --- |
| `room` | object | Required | A single `Room` record. | Must include stable `id` and `name`. |
| `scripts` | array | Required | Room scripts. Each item is a `Script` plus optional computed `currentVersion`. | Imported records are stored as scripts; computed `currentVersion` is stripped before persistence. |
| `scriptVersions` | array | Required | All versions referenced by the included scripts. | Each version must reference an imported script via `scriptId`. |
| `hintLadders` | array | Required | Hint ladders for the imported room. | Each ladder must reference the packet room via `roomId`. |
| `pronunciationGuide` | array | Required | Pronunciation terms for the imported room. | Each term must reference the packet room via `roomId`. |
| `acknowledgements` | array | Required | Acknowledgements for included scripts. | Computed staff display fields are stripped before persistence. |
| `scriptReadinessAudit` | object | Required | Readiness audit result for the room at export time. | Used for review only; scores recompute after import. |
| `integrationHints` | object | Optional | Notes for downstream MJW tools. | Consumers may ignore unknown keys. |

### Import Validation Rules

The client validates the file before applying any changes. Invalid JSON, missing room identity, duplicate IDs inside the imported packet, records assigned to a different room, and script versions referencing missing scripts block the import. Acknowledgements with staff or script context that may not exist after import produce warnings rather than hard failures because staff data can be managed separately.

| Validation Area | Blocking Error | Warning |
| --- | --- | --- |
| File format | File is not parseable JSON. | Not applicable. |
| Export type | JSON is not a `room_packet` export or legacy room packet shape. | Not applicable. |
| Required arrays | `scripts`, `scriptVersions`, `hintLadders`, `pronunciationGuide`, or `acknowledgements` are not arrays. | Not applicable. |
| Stable IDs | Records are missing IDs or duplicate IDs inside the packet. | Duplicate IDs already exist in the current app state. |
| Referential integrity | Scripts, hint ladders, or pronunciation terms reference a different room; script versions reference missing scripts. | Acknowledgements may reference staff context that is not present locally. |

### Import Modes

| Mode | Behavior | Recommended Use |
| --- | --- | --- |
| Safe Merge | Upserts imported records by stable ID and preserves unrelated local records. Matching records are replaced by the imported copy. | Routine room packet updates, moving room data between demo and production, targeted restore. |
| Overwrite Room | Replaces the existing room and all room-scoped scripts, script versions, hint ladders, pronunciation terms, and acknowledgements for the imported room. Unrelated rooms remain untouched. | Recovery from corrupted room data or deliberate authoritative restore of one room. |

## Staff Acknowledgement Report Payload

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `filters` | object | Required | Report filters used to generate the export. |
| `summary` | object | Required | Counts for `totalRows`, `current`, `outdated`, `notAcknowledged`, `revoked`, `superseded`, and `notReady`. |
| `rows` | array | Required | Acknowledgement report rows with room, staff, script, version, approval, status, acknowledgement, source, and notes fields. |

## Readiness Audit Report Payload

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `metadata` | object | Required | Audit generation timestamp, data source, room count, and issue count. |
| `summary` | object | Required | Average readiness score and issue counts by severity. |
| `rooms` | array | Required | Per-room score, issue counts, checklist items, and actionable audit issues. |
| `globalIssues` | array | Required | Global or orphan issues that are intentionally not duplicated into each room result. |

## Full Backup Payload

The `full_backup` payload contains the complete `AppState` under `payload.state`, plus record counts and restore guidance. It is intended as a backup and administrator migration format. Browser download is supported for managers and owners, but browser restore is intentionally limited to `room_packet` files to avoid accidental replacement of unrelated operational data.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `state` | object | Required | Complete operational state: rooms, scripts, script versions, hint ladders, pronunciation terms, staff members, acknowledgements, and audit events. |
| `counts` | object | Required | Record counts by collection. |
| `restoreGuidance` | object | Required | Notes describing safe client restore and administrator restore expectations. |

## Integration Packet Payload

The `integration_packet` payload gives MJW ecosystem tools a compact machine-readable summary without requiring full script bodies. It includes room readiness summaries, acknowledgement summaries, readiness report data, and a declared list of downstream consumers.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `rooms` | array | Required | Per-room operational summary with readiness score and content counts. |
| `readiness` | object | Required | Readiness report payload. |
| `acknowledgements` | object | Required | Acknowledgement report payload. |
| `downstreamConsumers` | array | Required | Intended MJW consumer applications. |

## Server-Side Production Export

When the application runs in production mode, the Export Center exposes a server-side export action that calls `/.netlify/functions/export-gms-data?type=full_backup`. This path is designed to generate exports from PocketBase backend collections rather than potentially stale browser state. The function requires production environment variables to be configured in Netlify.

| Environment Variable | Required | Description |
| --- | --- | --- |
| `PB_SERVICE_URL` | Required | Base URL for the production PocketBase service. |
| `PB_SUPERUSER_TOKEN` | Required | Server-only PocketBase service token used by the Netlify Function. |

The server function returns a schema-versioned JSON envelope with `generatedFrom: "server_backend"`. If credentials are not configured, it returns an explanatory failure response rather than falling back to client state.
