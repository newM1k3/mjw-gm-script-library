# PocketBase Production Schema for MJW GM Script Library

This document defines the first production-oriented PocketBase schema for the **MJW GM Script Library**. The application remains single-organization for now, but every collection includes an optional `organizationId` field so the model can evolve toward multi-organization tenancy without changing the current UI contract.

The frontend preserves its existing TypeScript `id` fields for UI compatibility. In PocketBase, those UI IDs are stored in a required unique `appId` text field instead of the built-in PocketBase `id`, because PocketBase record IDs have stricter format requirements than the demo fixture IDs. Relationship fields such as `roomId`, `scriptId`, and `versionId` therefore store the related record's `appId` value in this baseline implementation.

> Do not expose a PocketBase superuser token in the browser. The static frontend should use public/user access rules only. Any privileged migration, import, or administrative operation must be handled outside the browser, such as through a local admin session, one-time migration script, or future Netlify Function.

## Shared Field Conventions

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Stable application-level identifier | Unique index per collection | Readable by authenticated staff; writable only by managers/admin workflow |
| `organizationId` | Text | No | Reserved future tenant identifier | Non-unique index when multi-org is enabled | Include in future rules such as `organizationId = @request.auth.organizationId` |
| PocketBase `created` | Auto date | Yes | System metadata | Default | System-managed |
| PocketBase `updated` | Auto date | Yes | System metadata | Default | System-managed |

For the current single-organization deployment, access rules may start as authenticated-user rules. Before exposing the tool broadly, tighten rules by role and organization.

## Collection: `gms_rooms`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application room ID | Unique | Authenticated read; manager/admin write |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `name` | Text | Yes | None | Non-unique | Authenticated read; manager/admin write |
| `theme` | Text | No | None | None | Authenticated read; manager/admin write |
| `durationMinutes` | Number | Yes | None | None | Authenticated read; manager/admin write |
| `difficulty` | Select: `easy`, `medium`, `hard`, `expert` | Yes | None | Optional | Authenticated read; manager/admin write |
| `status` | Select: `active`, `inactive`, `maintenance`, `retired` | Yes | None | Non-unique | Authenticated read; manager/admin write |
| `notes` | Editor/Text | No | None | None | Authenticated read; manager/admin write |
| `createdAt` | Date | Yes | Application-created timestamp | Optional | Authenticated read; system/admin write |
| `updatedAt` | Date | Yes | Application-updated timestamp | Optional | Authenticated read; system/admin write |

## Collection: `gms_scripts`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application script ID | Unique | Authenticated read; manager/admin write |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `roomId` | Text | Yes | `gms_rooms.appId` | Non-unique | Authenticated read; manager/admin write |
| `title` | Text | Yes | None | Text search optional | Authenticated read; manager/admin write |
| `scriptType` | Select | Yes | Operational script type | Non-unique | Authenticated read; manager/admin write |
| `audience` | Text | No | None | None | Authenticated read; manager/admin write |
| `status` | Select: `draft`, `in_review`, `current`, `archived`, `needs_update` | Yes | None | Non-unique | Authenticated read; manager/admin write |
| `currentVersionId` | Text | No | `gms_script_versions.appId` | Non-unique | Authenticated read; manager/admin write |
| `tags` | JSON | No | String array | Optional | Authenticated read; manager/admin write |
| `createdAt` | Date | Yes | Application-created timestamp | Optional | Authenticated read; system/admin write |
| `updatedAt` | Date | Yes | Application-updated timestamp | Optional | Authenticated read; system/admin write |

Recommended future hardening: add optional PocketBase relation fields such as `roomRecord` and `currentVersionRecord` after a migration process can translate `appId` values into PocketBase record IDs.

## Collection: `gms_script_versions`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application version ID | Unique | Authenticated read; manager/admin write |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `scriptId` | Text | Yes | `gms_scripts.appId` | Non-unique | Authenticated read; manager/admin write |
| `versionNumber` | Text | Yes | Human version label | Compound with `scriptId` optional | Authenticated read; manager/admin write |
| `bodyMarkdown` | Editor/Text | Yes | Operational script body | Full-text search optional | Authenticated read; manager/admin write |
| `requiredBlocks` | JSON | No | String array | None | Authenticated read; manager/admin write |
| `optionalBlocks` | JSON | No | String array | None | Authenticated read; manager/admin write |
| `toneNotes` | Editor/Text | No | None | None | Authenticated read; manager/admin write |
| `changeSummary` | Editor/Text | No | Governance summary | None | Authenticated read; manager/admin write |
| `approvalStatus` | Select: `draft`, `in_review`, `approved`, `rejected` | Yes | Governance state | Non-unique | Authenticated read; reviewer/admin write |
| `approvedBy` | Text | No | Legacy approver name or staff ID | Optional | Authenticated read; reviewer/admin write |
| `approvedAt` | Date | No | Approval timestamp | Optional | Authenticated read; reviewer/admin write |
| `createdAt` | Date | Yes | Application-created timestamp | Optional | Authenticated read; system/admin write |
| `createdBy` | Text | No | `gms_staff_members.appId` or auth ID | Non-unique | Authenticated read; manager/admin write |
| `submittedBy` | Text | No | `gms_staff_members.appId` or auth ID | Non-unique | Authenticated read; manager/admin write |
| `reviewedBy` | Text | No | `gms_staff_members.appId` or auth ID | Non-unique | Authenticated read; reviewer/admin write |
| `rejectedAt` | Date | No | Rejection timestamp | Optional | Authenticated read; reviewer/admin write |
| `safetyBlockChecksum` | Text | No | Hash of safety-critical text | Non-unique | Authenticated read; system/admin write |
| `previousVersionId` | Text | No | `gms_script_versions.appId` | Non-unique | Authenticated read; manager/admin write |

## Collection: `gms_hint_ladders`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application hint ladder ID | Unique | Authenticated read; manager/admin write |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `roomId` | Text | Yes | `gms_rooms.appId` | Non-unique | Authenticated read; manager/admin write |
| `puzzleLabel` | Text | Yes | Puzzle identifier | Text search optional | Authenticated read; manager/admin write |
| `stageLabel` | Text | No | Game stage label | Optional | Authenticated read; manager/admin write |
| `triggerCondition` | Editor/Text | No | Operational trigger guidance | None | Authenticated read; manager/admin write |
| `hints` | JSON | Yes | Array of `{ level, text, spoilerLevel }` | None | Authenticated read; manager/admin write |
| `notes` | Editor/Text | No | Internal notes | None | Authenticated read; manager/admin write |
| `createdAt` | Date | Yes | Application-created timestamp | Optional | Authenticated read; system/admin write |
| `updatedAt` | Date | Yes | Application-updated timestamp | Optional | Authenticated read; system/admin write |

## Collection: `gms_pronunciation_terms`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application term ID | Unique | Authenticated read; manager/admin write |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `roomId` | Text | Yes | `gms_rooms.appId` | Non-unique | Authenticated read; manager/admin write |
| `term` | Text | Yes | Term to pronounce | Text search optional | Authenticated read; manager/admin write |
| `phonetic` | Text | No | Pronunciation spelling | None | Authenticated read; manager/admin write |
| `meaning` | Editor/Text | No | Contextual meaning | None | Authenticated read; manager/admin write |
| `context` | Editor/Text | No | Where term appears | None | Authenticated read; manager/admin write |
| `deliveryNote` | Editor/Text | No | GM delivery instruction | None | Authenticated read; manager/admin write |
| `audioNoteUrl` | URL/Text | No | Optional audio reference | None | Authenticated read; manager/admin write |
| `createdAt` | Date | Yes | Application-created timestamp | Optional | Authenticated read; system/admin write |
| `updatedAt` | Date | Yes | Application-updated timestamp | Optional | Authenticated read; system/admin write |

## Collection: `gms_staff_members`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application staff ID | Unique | Authenticated read; manager/admin write |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `name` | Text | Yes | Staff display name | Text search optional | Authenticated read; manager/admin write |
| `email` | Email/Text | No | Staff email | Unique if staff must not duplicate | Managers/admins only; staff may read own record later |
| `authUserId` | Text | No | PocketBase auth user ID | Unique optional | Managers/admins only; staff may read own record later |
| `role` | Text | Yes | Human role label | Optional | Authenticated read; manager/admin write |
| `permissionLevel` | Select: `owner`, `manager`, `lead_gm`, `gm`, `trainee`, `viewer` | No | App permission level | Non-unique | Managers/admins only |
| `active` | Bool | Yes | Employment/access state | Non-unique | Managers/admins only |
| `invitedAt` | Date | No | Invitation timestamp | Optional | Managers/admins only |
| `lastLoginAt` | Date | No | Last login timestamp | Optional | Managers/admins only |
| `notes` | Editor/Text | No | Internal staff notes | None | Managers/admins only |

## Collection: `gms_acknowledgements`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application acknowledgement ID | Unique | Authenticated read; staff self-create; manager/admin update |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `staffId` | Text | Yes | `gms_staff_members.appId` | Compound with `versionId` recommended | Staff may create own acknowledgement; managers/admins read |
| `scriptId` | Text | Yes | `gms_scripts.appId` | Non-unique | Authenticated read; staff self-create |
| `versionId` | Text | Yes | `gms_script_versions.appId` | Compound with `staffId` recommended | Authenticated read; staff self-create |
| `acknowledgedAt` | Date | Yes | Timestamp | Non-unique | System/staff create; manager/admin update |
| `acknowledgementTextSnapshot` | Editor/Text | No | Snapshot of acknowledged text | None | Authenticated read; system/staff create |
| `ipAddress` | Text | No | Request IP if captured server-side | None | Manager/admin only |
| `userAgent` | Text | No | Browser user agent | None | Manager/admin only |
| `source` | Select: `gm_mode`, `staff_training`, `manager_review`, `import`, `manual` | No | Acknowledgement source | Non-unique | Authenticated read; staff/system create |
| `supersededByVersionId` | Text | No | `gms_script_versions.appId` | Non-unique | Manager/admin write |
| `revokedAt` | Date | No | Revocation timestamp | Optional | Manager/admin write |
| `revokedBy` | Text | No | `gms_staff_members.appId` or auth ID | Optional | Manager/admin write |
| `notes` | Editor/Text | No | Internal notes | None | Manager/admin write |

## Collection: `gms_audit_events`

| Field | Type | Required | Relation | Index Recommendation | Access Rule Recommendation |
|---|---|---:|---|---|---|
| `appId` | Text | Yes | Application audit event ID | Unique | Authenticated read; system/admin create |
| `organizationId` | Text | No | Future organization scope | Non-unique | Restrict by organization later |
| `action` | Select: `create`, `update`, `delete`, `approve`, `make-current`, `acknowledge`, `export`, `import` | Yes | Audited action | Non-unique | Authenticated read; system/admin create |
| `entityType` | Select: `room`, `script`, `script_version`, `hint_ladder`, `pronunciation_term`, `staff_member`, `acknowledgement`, `room_packet`, `app_state` | Yes | Affected entity type | Non-unique | Authenticated read; system/admin create |
| `entityId` | Text | Yes | Affected entity app ID | Non-unique | Authenticated read; system/admin create |
| `roomId` | Text | No | `gms_rooms.appId` | Non-unique | Authenticated read; system/admin create |
| `scriptId` | Text | No | `gms_scripts.appId` | Non-unique | Authenticated read; system/admin create |
| `versionId` | Text | No | `gms_script_versions.appId` | Non-unique | Authenticated read; system/admin create |
| `staffId` | Text | No | `gms_staff_members.appId` | Non-unique | Authenticated read; system/admin create |
| `actorStaffId` | Text | No | Acting `gms_staff_members.appId` | Non-unique | Manager/admin read; system/admin create |
| `actorAuthUserId` | Text | No | PocketBase auth user ID | Non-unique | Manager/admin read; system/admin create |
| `summary` | Text | Yes | Human-readable event summary | Text search optional | Authenticated read; system/admin create |
| `metadata` | JSON | No | Structured event details | None | Manager/admin read; system/admin create |
| `ipAddress` | Text | No | Request IP if captured server-side | None | Manager/admin only |
| `userAgent` | Text | No | Browser user agent | None | Manager/admin only |
| `createdAt` | Date | Yes | Application event timestamp | Non-unique descending | Authenticated read; system/admin create |

## Baseline Access Rules

For a private single-organization internal deployment, a practical first pass is:

| Collection Group | List/View Rule | Create Rule | Update Rule | Delete Rule |
|---|---|---|---|---|
| Operational content collections | `@request.auth.id != ""` | `@request.auth.id != ""` initially; tighten to manager roles later | `@request.auth.id != ""` initially; tighten to manager roles later | Managers/admins only after role enforcement exists |
| Staff records | `@request.auth.id != ""` initially | Managers/admins only | Managers/admins only | Managers/admins only |
| Acknowledgements | `@request.auth.id != ""` | `@request.auth.id != ""` | Managers/admins only except staff self-revocation if allowed | Managers/admins only |
| Audit events | `@request.auth.id != ""` | System/admin workflow only when possible | Empty/false after creation | Empty/false after creation |

Until role-aware authentication is implemented in the app, avoid enabling broad public rules. If the frontend must run without login during testing, use demo mode instead of loosening production PocketBase rules.

## Manual Creation Checklist

| Step | Action |
|---:|---|
| 1 | Create the eight collections with the exact names above. |
| 2 | Add `appId` as a required text field to every collection and configure a unique index if available. |
| 3 | Add the collection-specific fields using the exact camelCase names in this document. |
| 4 | Add non-unique indexes for lookup fields such as `roomId`, `scriptId`, `versionId`, `staffId`, `status`, and `approvalStatus`. |
| 5 | Configure authenticated access rules for the private internal deployment. |
| 6 | Set `VITE_DATA_MODE=pocketbase` and `VITE_POCKETBASE_URL=https://your-pocketbase-host.example` in the frontend environment. |
| 7 | Do not add or expose any PocketBase superuser token to Vite, Netlify public variables, or browser code. |
