import {
  Acknowledgement,
  AcknowledgementReportFilters,
  AppState,
  AuditEvent,
  HintLadder,
  PronunciationTerm,
  Room,
  Script,
  ScriptReadinessResult,
  ScriptVersion,
} from '../types';
import { buildAcknowledgementReportRows, acknowledgementStatusLabels, formatApprovalDate } from '../lib/acknowledgements';
import { runAllAudits, runAudit, runGlobalAuditIssues } from '../lib/scriptAudit';

export const GMS_EXPORT_SCHEMA_VERSION = '1.0.0';
export const GMS_SOURCE_APP = 'GM Script Library';

export type GmsExportType =
  | 'room_packet'
  | 'staff_acknowledgement_report'
  | 'readiness_audit_report'
  | 'full_backup'
  | 'integration_packet';

export type ImportMode = 'merge' | 'overwrite_room';

interface ExportEnvelope<TPayload> {
  gms_export_schema_version: typeof GMS_EXPORT_SCHEMA_VERSION;
  version: typeof GMS_EXPORT_SCHEMA_VERSION;
  sourceApp: typeof GMS_SOURCE_APP;
  exportType: GmsExportType;
  reportType?: string;
  exportedAt: string;
  generatedFrom: 'client_state' | 'server_backend';
  producer: {
    app: typeof GMS_SOURCE_APP;
    platform: 'MJW Personal App Platform';
    schemaDocumentation: 'docs/export-schema.md';
  };
  payload: TPayload;
}

export interface RoomPacketPayload {
  room: Room;
  scripts: Array<Script & { currentVersion: ScriptVersion | null }>;
  scriptVersions: ScriptVersion[];
  hintLadders: HintLadder[];
  pronunciationGuide: PronunciationTerm[];
  acknowledgements: Array<Acknowledgement & { staffName?: string; staffRole?: string }>;
  scriptReadinessAudit: ScriptReadinessResult;
  integrationHints: Record<string, unknown>;
}

export interface RoomPacketImportPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  roomName: string;
  roomId: string;
  counts: {
    rooms: number;
    scripts: number;
    scriptVersions: number;
    hintLadders: number;
    pronunciationTerms: number;
    acknowledgements: number;
  };
  duplicates: {
    room: boolean;
    scripts: number;
    scriptVersions: number;
    hintLadders: number;
    pronunciationTerms: number;
    acknowledgements: number;
  };
  packet?: RoomPacketPayload;
}

function nowIso(): string {
  return new Date().toISOString();
}

function envelope<TPayload>(exportType: GmsExportType, payload: TPayload, reportType?: string): ExportEnvelope<TPayload> {
  return {
    gms_export_schema_version: GMS_EXPORT_SCHEMA_VERSION,
    version: GMS_EXPORT_SCHEMA_VERSION,
    sourceApp: GMS_SOURCE_APP,
    exportType,
    reportType,
    exportedAt: nowIso(),
    generatedFrom: 'client_state',
    producer: {
      app: GMS_SOURCE_APP,
      platform: 'MJW Personal App Platform',
      schemaDocumentation: 'docs/export-schema.md',
    },
    payload,
  };
}

function roomIntegrationHints(): Record<string, unknown> {
  return {
    recommendedDestinations: [
      'RoomReady Ops',
      'Puzzle Flow Visualizer',
      'Puzzle Dependency Auditor',
      'LockMap Studio',
      'Room Layout Risk Mapper',
      'MJW Operator Toolkit',
    ],
    roomReadyOpsUse: 'Convert current-script acknowledgement status into pre-shift readiness tasks. Flag any staff with outstanding acknowledgements as a pre-game blocker.',
    puzzleFlowUse: 'Associate hint ladders with puzzle flow stages. Import stage labels from Puzzle Flow Visualizer to auto-scaffold hint ladder entries.',
    puzzleDependencyAuditorUse: 'Use dependency audit results to identify high-risk progression nodes and auto-suggest hint ladder coverage.',
    lockMapStudioUse: 'Import ambiguous lock and answer notes as GM hint annotations to reduce over-hinting on unclear locks.',
    roomLayoutRiskMapperUse: 'Create GM watch prompts for physical bottleneck zones and sightline risk areas identified in layout audits.',
    mjwOperatorToolkitUse: 'Bundle with RoomReady Ops for a unified pre-shift readiness and script consistency dashboard.',
    pocketBaseIntegration: 'Production persistence via PocketBase at VITE_POCKETBASE_URL. Collections: gms_rooms, gms_scripts, gms_script_versions, gms_hint_ladders, gms_pronunciation_terms, gms_acknowledgements.',
    netlifyFunctionExport: 'Production server-side exports are available through /.netlify/functions/export-gms-data when PocketBase service credentials are configured.',
  };
}

export function buildRoomPacketPayload(state: AppState, roomId: string): RoomPacketPayload | null {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const scripts = state.scripts.filter((s) => s.roomId === roomId);
  const scriptIds = scripts.map((s) => s.id);
  const scriptVersions = state.scriptVersions.filter((v) => scriptIds.includes(v.scriptId));
  const hintLadders = state.hintLadders.filter((h) => h.roomId === roomId);
  const pronunciationGuide = state.pronunciationTerms.filter((t) => t.roomId === roomId);
  const acknowledgements = state.acknowledgements.filter((a) => scriptIds.includes(a.scriptId));
  const auditResult: ScriptReadinessResult = runAudit(state, room);

  const scriptsWithCurrentVersion = scripts.map((script) => ({
    ...script,
    currentVersion: scriptVersions.find((v) => v.id === script.currentVersionId) ?? null,
  }));

  return {
    room,
    scripts: scriptsWithCurrentVersion,
    scriptVersions,
    hintLadders,
    pronunciationGuide,
    acknowledgements: acknowledgements.map((a) => {
      const staff = state.staffMembers.find((s) => s.id === a.staffId);
      return { ...a, staffName: staff?.name ?? 'Unknown', staffRole: staff?.role ?? 'Unknown' };
    }),
    scriptReadinessAudit: auditResult,
    integrationHints: roomIntegrationHints(),
  };
}

export function buildRoomPacketExport(state: AppState, roomId: string): ExportEnvelope<RoomPacketPayload> | null {
  const payload = buildRoomPacketPayload(state, roomId);
  return payload ? envelope('room_packet', payload, 'room_packet') : null;
}

export function exportRoomJSON(state: AppState, roomId: string): string {
  const packet = buildRoomPacketExport(state, roomId);
  if (!packet) return '{}';

  return JSON.stringify(
    {
      ...packet,
      ...packet.payload,
    },
    null,
    2
  );
}

export function exportRoomMarkdown(state: AppState, roomId: string): string {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return '# Room not found';

  const scripts = state.scripts.filter((s) => s.roomId === roomId);
  const hintLadders = state.hintLadders.filter((h) => h.roomId === roomId);
  const pronunciationTerms = state.pronunciationTerms.filter((t) => t.roomId === roomId);
  const auditResult = runAudit(state, room);
  const lines: string[] = [];

  lines.push(`# GM Script Library — Room Script Packet`);
  lines.push(`**Schema Version:** ${GMS_EXPORT_SCHEMA_VERSION}`);
  lines.push(`**Export Type:** room_packet`);
  lines.push(`**Room:** ${room.name}`);
  lines.push(`**Theme:** ${room.theme}`);
  lines.push(`**Duration:** ${room.durationMinutes} minutes`);
  lines.push(`**Difficulty:** ${room.difficulty}`);
  lines.push(`**Status:** ${room.status}`);
  lines.push(`**Exported:** ${new Date().toLocaleDateString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## Script Readiness Score: ${auditResult.score}/100`);
  lines.push('');

  if (auditResult.issues.length === 0) {
    lines.push('All checks passed. This room is ready for GM delivery.');
  } else {
    lines.push(`**Issues:** ${auditResult.criticalCount} critical · ${auditResult.warningCount} warnings · ${auditResult.improvementCount} improvements`);
    lines.push('');
    lines.push('### Unresolved Issues');
    for (const issue of auditResult.issues) {
      const icon = issue.severity === 'critical' ? '[CRITICAL]' : issue.severity === 'warning' ? '[WARNING]' : '[IMPROVEMENT]';
      lines.push(`- ${icon} ${issue.description}`);
      lines.push(`  *Fix:* ${issue.recommendation}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  if (room.notes) {
    lines.push('## Room Notes');
    lines.push(room.notes);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const scriptTypeOrder = ['safety_brief','pre_game_brief','story_intro','character_intro','mid_game_intervention','hint_ladder','post_game_debrief','reset_note','training_note'] as const;
  const scriptTypeLabels: Record<string, string> = {
    safety_brief: 'Safety Briefing', pre_game_brief: 'Pre-Game Briefing', story_intro: 'Story Introduction',
    character_intro: 'Character Introduction', mid_game_intervention: 'Mid-Game Intervention',
    hint_ladder: 'Hint Ladder Script', post_game_debrief: 'Post-Game Debrief',
    reset_note: 'Reset Notes', training_note: 'Training Notes',
  };

  lines.push('## Scripts');
  lines.push('');

  for (const scriptType of scriptTypeOrder) {
    const typeScripts = scripts.filter((s) => s.scriptType === scriptType);
    if (typeScripts.length === 0) continue;
    lines.push(`### ${scriptTypeLabels[scriptType] ?? scriptType}`);
    lines.push('');
    for (const script of typeScripts) {
      const currentVersion = state.scriptVersions.find((v) => v.id === script.currentVersionId);
      lines.push(`#### ${script.title}`);
      if (script.tags.length > 0) lines.push(`*Tags: ${script.tags.join(', ')}*`);
      lines.push('');
      if (currentVersion) {
        lines.push(`**Version:** ${currentVersion.versionNumber} | **Approved:** ${currentVersion.approvedAt ? new Date(currentVersion.approvedAt).toLocaleDateString() : 'N/A'} | **By:** ${currentVersion.approvedBy || 'N/A'}`);
        if (currentVersion.toneNotes) lines.push(`**Tone Notes:** ${currentVersion.toneNotes}`);
        if (currentVersion.requiredBlocks.length > 0) lines.push(`**Required Blocks:** ${currentVersion.requiredBlocks.join(', ')}`);
        lines.push('');
        lines.push(currentVersion.bodyMarkdown);
      } else {
        lines.push('*No current approved version.*');
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  if (hintLadders.length > 0) {
    lines.push('## Hint Ladders');
    lines.push('');
    for (const ladder of hintLadders) {
      lines.push(`### ${ladder.puzzleLabel}`);
      lines.push(`**Stage:** ${ladder.stageLabel}`);
      lines.push(`**Trigger:** ${ladder.triggerCondition}`);
      if (ladder.notes) lines.push(`**Notes:** ${ladder.notes}`);
      lines.push('');
      for (const hint of ladder.hints.sort((a, b) => a.level - b.level)) {
        lines.push(`**Level ${hint.level}** [${hint.spoilerLevel.toUpperCase()} SPOILER]`);
        lines.push(`> ${hint.text}`);
        lines.push('');
      }
    }
    lines.push('---');
    lines.push('');
  }

  if (pronunciationTerms.length > 0) {
    lines.push('## Pronunciation Guide');
    lines.push('');
    for (const term of pronunciationTerms) {
      lines.push(`### ${term.term}`);
      if (term.phonetic) lines.push(`**Phonetic:** ${term.phonetic}`);
      if (term.meaning) lines.push(`**Meaning:** ${term.meaning}`);
      if (term.context) lines.push(`**Context:** ${term.context}`);
      if (term.deliveryNote) lines.push(`**Delivery Note:** ${term.deliveryNote}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  lines.push('## Staff Acknowledgement Summary');
  lines.push('');
  const currentScripts = scripts.filter((s) => s.currentVersionId);
  for (const staff of state.staffMembers.filter((s) => s.active)) {
    lines.push(`### ${staff.name} (${staff.role})`);
    for (const script of currentScripts) {
      const ack = state.acknowledgements.find(
        (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId
      );
      const status = ack ? `Acknowledged ${new Date(ack.acknowledgedAt).toLocaleDateString()}` : 'NOT ACKNOWLEDGED';
      lines.push(`- **${script.title}:** ${status}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Change History');
  lines.push('');
  for (const script of scripts) {
    const versions = state.scriptVersions
      .filter((v) => v.scriptId === script.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (versions.length > 0) {
      lines.push(`### ${script.title}`);
      for (const version of versions) {
        const isCurrent = version.id === script.currentVersionId;
        lines.push(`- **v${version.versionNumber}**${isCurrent ? ' *(current)*' : ''} — ${new Date(version.createdAt).toLocaleDateString()} — ${version.changeSummary}`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by GM Script Library · MJW Personal App Platform*');
  lines.push('');
  lines.push('**Future Integration Note:** This packet can be imported into RoomReady Ops for pre-shift acknowledgement tasks, and into Puzzle Flow Visualizer for stage-based hint ladder alignment.');

  return lines.join('\n');
}

export function buildAcknowledgementReportPayload(state: AppState, filters: AcknowledgementReportFilters = {}) {
  const rows = buildAcknowledgementReportRows(state, filters);
  return {
    filters,
    summary: {
      totalRows: rows.length,
      current: rows.filter((row) => row.status === 'current').length,
      outdated: rows.filter((row) => row.status === 'outdated').length,
      notAcknowledged: rows.filter((row) => row.status === 'not_acknowledged').length,
      revoked: rows.filter((row) => row.status === 'revoked').length,
      superseded: rows.filter((row) => row.status === 'superseded').length,
      notReady: rows.filter((row) => row.status !== 'current').length,
    },
    rows,
  };
}

export function exportAcknowledgementReportJSON(state: AppState, filters: AcknowledgementReportFilters = {}): string {
  const report = envelope('staff_acknowledgement_report', buildAcknowledgementReportPayload(state, filters), 'staff_acknowledgements');
  return JSON.stringify(report, null, 2);
}

export function exportAcknowledgementReportMarkdown(state: AppState, filters: AcknowledgementReportFilters = {}): string {
  const rows = buildAcknowledgementReportRows(state, filters);
  const notReadyRows = rows.filter((row) => row.status !== 'current');
  const lines: string[] = [];

  lines.push('# GM Script Library — Staff Acknowledgement Compliance Report');
  lines.push(`**Schema Version:** ${GMS_EXPORT_SCHEMA_VERSION}`);
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push(`**Rows:** ${rows.length}`);
  lines.push(`**Ready:** ${rows.filter((row) => row.status === 'current').length}`);
  lines.push(`**Not Ready:** ${notReadyRows.length}`);
  lines.push('');
  lines.push('## Status Summary');
  lines.push('');
  lines.push('| Status | Count |');
  lines.push('| --- | ---: |');
  (['current', 'outdated', 'not_acknowledged', 'revoked', 'superseded'] as const).forEach((status) => {
    lines.push(`| ${acknowledgementStatusLabels[status]} | ${rows.filter((row) => row.status === status).length} |`);
  });
  lines.push('');

  if (notReadyRows.length > 0) {
    lines.push('## Staff Not Ready to Run a Room');
    lines.push('');
    lines.push('| Room | Staff | Role | Script | Version | Status | Required Blocks |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    notReadyRows.forEach((row) => {
      lines.push(`| ${row.roomName} | ${row.staffName} | ${row.staffRole} | ${row.scriptTitle} | ${row.currentVersionNumber} | ${acknowledgementStatusLabels[row.status]} | ${row.requiredBlocks.join(', ') || 'None'} |`);
    });
    lines.push('');
  }

  lines.push('## Full Acknowledgement Matrix');
  lines.push('');
  lines.push('| Room | Staff | Role | Script Type | Script | Version | Approved | Status | Acknowledged At |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  rows.forEach((row) => {
    lines.push(`| ${row.roomName} | ${row.staffName} | ${row.staffRole} | ${row.scriptType} | ${row.scriptTitle} | ${row.currentVersionNumber} | ${formatApprovalDate(row.approvalDate)} | ${acknowledgementStatusLabels[row.status]} | ${row.acknowledgedAt ? new Date(row.acknowledgedAt).toLocaleString() : '—'} |`);
  });

  lines.push('');
  lines.push('## Acknowledgement Text Snapshots');
  lines.push('');
  rows.filter((row) => row.acknowledgementTextSnapshot).forEach((row) => {
    lines.push(`### ${row.staffName} — ${row.scriptTitle}`);
    lines.push(`> ${row.acknowledgementTextSnapshot}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function buildReadinessReportPayload(
  state: AppState,
  auditResults: ScriptReadinessResult[] = runAllAudits(state),
  globalIssues = runGlobalAuditIssues(state)
) {
  const allIssues = [...auditResults.flatMap((result) => result.issues), ...globalIssues];
  return {
    metadata: {
      generatedAt: auditResults[0]?.generatedAt ?? nowIso(),
      dataSource: auditResults[0]?.dataSource ?? 'local',
      roomCount: state.rooms.length,
      issueCount: allIssues.length,
    },
    summary: {
      averageScore: auditResults.length > 0 ? Math.round(auditResults.reduce((sum, result) => sum + result.score, 0) / auditResults.length) : 100,
      critical: allIssues.filter((issue) => issue.severity === 'critical').length,
      warnings: allIssues.filter((issue) => issue.severity === 'warning').length,
      improvements: allIssues.filter((issue) => issue.severity === 'improvement').length,
      open: allIssues.filter((issue) => issue.status === 'open').length,
    },
    rooms: auditResults.map((result) => ({
      room: state.rooms.find((room) => room.id === result.roomId) ?? null,
      score: result.score,
      issueCounts: {
        critical: result.criticalCount,
        warnings: result.warningCount,
        improvements: result.improvementCount,
      },
      checklist: result.checklist,
      issues: result.issues,
    })),
    globalIssues,
  };
}

export function exportReadinessJSON(
  state: AppState,
  auditResults: ScriptReadinessResult[] = runAllAudits(state),
  globalIssues = runGlobalAuditIssues(state)
): string {
  const report = envelope('readiness_audit_report', buildReadinessReportPayload(state, auditResults, globalIssues), 'readiness_audit');
  return JSON.stringify(report, null, 2);
}

export function exportReadinessMarkdown(
  state: AppState,
  auditResults: ScriptReadinessResult[] = runAllAudits(state),
  globalIssues = runGlobalAuditIssues(state)
): string {
  const allIssues = [...auditResults.flatMap((result) => result.issues), ...globalIssues];
  const averageScore = auditResults.length > 0 ? Math.round(auditResults.reduce((sum, result) => sum + result.score, 0) / auditResults.length) : 100;
  const lines: string[] = [];

  lines.push('# GM Script Library — Readiness Audit Report');
  lines.push(`**Schema Version:** ${GMS_EXPORT_SCHEMA_VERSION}`);
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push(`**Generated:** ${auditResults[0]?.generatedAt ? new Date(auditResults[0].generatedAt).toLocaleString() : new Date().toLocaleString()}`);
  lines.push(`**Data Source:** ${auditResults[0]?.dataSource ?? 'local'}`);
  lines.push(`**Average Score:** ${averageScore}/100`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Rooms Audited | ${auditResults.length} |`);
  lines.push(`| Critical Issues | ${allIssues.filter((issue) => issue.severity === 'critical').length} |`);
  lines.push(`| Warnings | ${allIssues.filter((issue) => issue.severity === 'warning').length} |`);
  lines.push(`| Improvements | ${allIssues.filter((issue) => issue.severity === 'improvement').length} |`);
  lines.push(`| Total Open Issues | ${allIssues.filter((issue) => issue.status === 'open').length} |`);
  lines.push('');

  if (globalIssues.length > 0) {
    lines.push('## Global Library Issues');
    lines.push('');
    lines.push('| Severity | Category | Issue | Remediation |');
    lines.push('| --- | --- | --- | --- |');
    globalIssues.forEach((issue) => {
      lines.push(`| ${issue.severity} | ${issue.category} | ${issue.description} | ${issue.recommendation} |`);
    });
    lines.push('');
  }

  lines.push('## Room Results');
  lines.push('');
  auditResults.forEach((result) => {
    const room = state.rooms.find((candidate) => candidate.id === result.roomId);
    lines.push(`### ${room?.name ?? result.roomId} — ${result.score}/100`);
    lines.push('');
    lines.push('| Severity | Category | Status | Issue | Fix | Action |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    if (result.issues.length === 0) {
      lines.push('| — | — | resolved | All checks passed. | Continue periodic review. | No action needed |');
    } else {
      result.issues.forEach((issue) => {
        lines.push(`| ${issue.severity} | ${issue.category} | ${issue.status} | ${issue.description} | ${issue.recommendation} | ${issue.remediation.label} |`);
      });
    }
    lines.push('');
    lines.push('#### Checklist');
    lines.push('');
    lines.push('| Item | Category | Complete | Notes |');
    lines.push('| --- | --- | --- | --- |');
    result.checklist.forEach((item) => {
      lines.push(`| ${item.label} | ${item.category} | ${item.complete ? 'Yes' : 'No'} | ${item.description} |`);
    });
    lines.push('');
  });

  lines.push('---');
  lines.push('');
  lines.push('*Generated by GM Script Library · MJW Personal App Platform*');

  return lines.join('\n');
}

export function buildFullBackupPayload(state: AppState) {
  return {
    state,
    counts: {
      rooms: state.rooms.length,
      scripts: state.scripts.length,
      scriptVersions: state.scriptVersions.length,
      hintLadders: state.hintLadders.length,
      pronunciationTerms: state.pronunciationTerms.length,
      staffMembers: state.staffMembers.length,
      acknowledgements: state.acknowledgements.length,
      auditEvents: state.auditEvents?.length ?? 0,
    },
    restoreGuidance: {
      safeDefault: 'Import room packets first for scoped restore. Use full backup restore only from a trusted GM Script Library export.',
      supportedClientRestore: ['room_packet'],
      intendedAdminRestore: ['full_backup'],
    },
  };
}

export function exportFullBackupJSON(state: AppState): string {
  return JSON.stringify(envelope('full_backup', buildFullBackupPayload(state), 'full_backup'), null, 2);
}

export function buildIntegrationPacketPayload(state: AppState) {
  const auditResults = runAllAudits(state);
  const globalIssues = runGlobalAuditIssues(state);
  return {
    rooms: state.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      status: room.status,
      difficulty: room.difficulty,
      durationMinutes: room.durationMinutes,
      readinessScore: auditResults.find((result) => result.roomId === room.id)?.score ?? null,
      scriptCount: state.scripts.filter((script) => script.roomId === room.id).length,
      activeHintLadderCount: state.hintLadders.filter((hint) => hint.roomId === room.id).length,
      pronunciationTermCount: state.pronunciationTerms.filter((term) => term.roomId === room.id).length,
    })),
    readiness: buildReadinessReportPayload(state, auditResults, globalIssues),
    acknowledgements: buildAcknowledgementReportPayload(state),
    downstreamConsumers: [
      'RoomReady Ops',
      'Puzzle Flow Visualizer',
      'Puzzle Dependency Auditor',
      'LockMap Studio',
      'Room Layout Risk Mapper',
      'MJW Operator Toolkit',
    ],
  };
}

export function exportIntegrationPacketJSON(state: AppState): string {
  return JSON.stringify(envelope('integration_packet', buildIntegrationPacketPayload(state), 'integration_packet'), null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractRoomPacketPayload(parsed: unknown): RoomPacketPayload | null {
  if (!isRecord(parsed)) return null;
  if (parsed.exportType === 'room_packet' && isRecord(parsed.payload)) return parsed.payload as unknown as RoomPacketPayload;
  if (isRecord(parsed.room) && Array.isArray(parsed.scripts)) return parsed as unknown as RoomPacketPayload;
  return null;
}

function hasString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueCount<T extends { id: string }>(records: T[]): number {
  return new Set(records.map((record) => record.id)).size;
}

function validateRecords<T extends { id: string }>(records: T[], label: string, errors: string[]): void {
  records.forEach((record, index) => {
    if (!hasString(record.id)) errors.push(`${label} at index ${index} is missing a stable id.`);
  });
  if (uniqueCount(records) !== records.length) errors.push(`${label} contains duplicate ids inside the imported packet.`);
}

export function previewRoomPacketImport(rawJson: string, currentState: AppState): RoomPacketImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      errors: ['The selected file is not valid JSON.'],
      warnings: [],
      roomName: 'Unknown room',
      roomId: '',
      counts: { rooms: 0, scripts: 0, scriptVersions: 0, hintLadders: 0, pronunciationTerms: 0, acknowledgements: 0 },
      duplicates: { room: false, scripts: 0, scriptVersions: 0, hintLadders: 0, pronunciationTerms: 0, acknowledgements: 0 },
    };
  }

  const packet = extractRoomPacketPayload(parsed);
  if (!packet) {
    errors.push('This JSON is not a GM Script Library room_packet export.');
  }

  const room = packet?.room;
  const scripts = packet?.scripts ?? [];
  const scriptVersions = packet?.scriptVersions ?? [];
  const hintLadders = packet?.hintLadders ?? [];
  const pronunciationGuide = packet?.pronunciationGuide ?? [];
  const acknowledgements = packet?.acknowledgements ?? [];

  if (!room || !hasString(room.id) || !hasString(room.name)) errors.push('The room packet must include a room with id and name.');
  if (!Array.isArray(scripts)) errors.push('The room packet scripts field must be an array.');
  if (!Array.isArray(scriptVersions)) errors.push('The room packet scriptVersions field must be an array.');
  if (!Array.isArray(hintLadders)) errors.push('The room packet hintLadders field must be an array.');
  if (!Array.isArray(pronunciationGuide)) errors.push('The room packet pronunciationGuide field must be an array.');
  if (!Array.isArray(acknowledgements)) errors.push('The room packet acknowledgements field must be an array.');

  validateRecords(scripts, 'scripts', errors);
  validateRecords(scriptVersions, 'scriptVersions', errors);
  validateRecords(hintLadders, 'hintLadders', errors);
  validateRecords(pronunciationGuide, 'pronunciationGuide', errors);
  validateRecords(acknowledgements, 'acknowledgements', errors);

  if (room) {
    scripts.forEach((script) => {
      if (script.roomId !== room.id) errors.push(`Script ${script.id} belongs to room ${script.roomId}, not imported room ${room.id}.`);
    });
    hintLadders.forEach((ladder) => {
      if (ladder.roomId !== room.id) errors.push(`Hint ladder ${ladder.id} belongs to room ${ladder.roomId}, not imported room ${room.id}.`);
    });
    pronunciationGuide.forEach((term) => {
      if (term.roomId !== room.id) errors.push(`Pronunciation term ${term.id} belongs to room ${term.roomId}, not imported room ${room.id}.`);
    });
  }

  const scriptIds = new Set(scripts.map((script) => script.id));
  scriptVersions.forEach((version) => {
    if (!scriptIds.has(version.scriptId)) errors.push(`Script version ${version.id} references missing script ${version.scriptId}.`);
  });
  acknowledgements.forEach((ack) => {
    if (!scriptIds.has(ack.scriptId)) warnings.push(`Acknowledgement ${ack.id} references staff/script context that may not exist after import.`);
  });

  const duplicates = {
    room: Boolean(room && currentState.rooms.some((existing) => existing.id === room.id)),
    scripts: scripts.filter((script) => currentState.scripts.some((existing) => existing.id === script.id)).length,
    scriptVersions: scriptVersions.filter((version) => currentState.scriptVersions.some((existing) => existing.id === version.id)).length,
    hintLadders: hintLadders.filter((ladder) => currentState.hintLadders.some((existing) => existing.id === ladder.id)).length,
    pronunciationTerms: pronunciationGuide.filter((term) => currentState.pronunciationTerms.some((existing) => existing.id === term.id)).length,
    acknowledgements: acknowledgements.filter((ack) => currentState.acknowledgements.some((existing) => existing.id === ack.id)).length,
  };

  if (duplicates.room) warnings.push('A room with this id already exists. Merge will update matching imported records; overwrite will replace the existing room packet records.');
  if (duplicates.scripts + duplicates.scriptVersions + duplicates.hintLadders + duplicates.pronunciationTerms + duplicates.acknowledgements > 0) {
    warnings.push('Duplicate record ids were found. Matching imported records will replace existing records with the same id.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    roomName: room?.name ?? 'Unknown room',
    roomId: room?.id ?? '',
    counts: {
      rooms: room ? 1 : 0,
      scripts: scripts.length,
      scriptVersions: scriptVersions.length,
      hintLadders: hintLadders.length,
      pronunciationTerms: pronunciationGuide.length,
      acknowledgements: acknowledgements.length,
    },
    duplicates,
    packet: errors.length === 0 ? packet ?? undefined : undefined,
  };
}

function stripComputedScriptFields(script: Script & { currentVersion?: ScriptVersion | null }): Script {
  const cleanScript = { ...script };
  delete cleanScript.currentVersion;
  return cleanScript;
}

function stripComputedAcknowledgementFields(acknowledgement: Acknowledgement & { staffName?: string; staffRole?: string }): Acknowledgement {
  const cleanAcknowledgement = { ...acknowledgement };
  delete cleanAcknowledgement.staffName;
  delete cleanAcknowledgement.staffRole;
  return cleanAcknowledgement;
}

function upsertById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((record) => record.id));
  return [...current.filter((record) => !incomingIds.has(record.id)), ...incoming];
}

function buildImportAuditEvent(packet: RoomPacketPayload, mode: ImportMode): AuditEvent {
  const timestamp = nowIso();
  return {
    id: `audit_import_${packet.room.id}_${Date.now()}`,
    action: 'import',
    entityType: 'room_packet',
    entityId: packet.room.id,
    roomId: packet.room.id,
    summary: `${mode === 'overwrite_room' ? 'Overwrote' : 'Merged'} room packet import for ${packet.room.name}`,
    metadata: {
      mode,
      schemaVersion: GMS_EXPORT_SCHEMA_VERSION,
      scripts: packet.scripts.length,
      scriptVersions: packet.scriptVersions.length,
      hintLadders: packet.hintLadders.length,
      pronunciationTerms: packet.pronunciationGuide.length,
      acknowledgements: packet.acknowledgements.length,
    },
    createdAt: timestamp,
  };
}

export function applyRoomPacketImport(currentState: AppState, packet: RoomPacketPayload, mode: ImportMode): AppState {
  const cleanScripts = packet.scripts.map(stripComputedScriptFields);
  const cleanAcknowledgements = packet.acknowledgements.map(stripComputedAcknowledgementFields);
  const packetScriptIds = new Set(cleanScripts.map((script) => script.id));

  if (mode === 'overwrite_room') {
    return {
      ...currentState,
      rooms: [...currentState.rooms.filter((room) => room.id !== packet.room.id), packet.room],
      scripts: [...currentState.scripts.filter((script) => script.roomId !== packet.room.id), ...cleanScripts],
      scriptVersions: [...currentState.scriptVersions.filter((version) => !packetScriptIds.has(version.scriptId)), ...packet.scriptVersions],
      hintLadders: [...currentState.hintLadders.filter((ladder) => ladder.roomId !== packet.room.id), ...packet.hintLadders],
      pronunciationTerms: [...currentState.pronunciationTerms.filter((term) => term.roomId !== packet.room.id), ...packet.pronunciationGuide],
      acknowledgements: [...currentState.acknowledgements.filter((ack) => !packetScriptIds.has(ack.scriptId)), ...cleanAcknowledgements],
      auditEvents: [...(currentState.auditEvents ?? []), buildImportAuditEvent(packet, mode)],
    };
  }

  return {
    ...currentState,
    rooms: upsertById(currentState.rooms, [packet.room]),
    scripts: upsertById(currentState.scripts, cleanScripts),
    scriptVersions: upsertById(currentState.scriptVersions, packet.scriptVersions),
    hintLadders: upsertById(currentState.hintLadders, packet.hintLadders),
    pronunciationTerms: upsertById(currentState.pronunciationTerms, packet.pronunciationGuide),
    acknowledgements: upsertById(currentState.acknowledgements, cleanAcknowledgements),
    auditEvents: [...(currentState.auditEvents ?? []), buildImportAuditEvent(packet, mode)],
  };
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
