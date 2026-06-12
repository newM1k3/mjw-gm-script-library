import {
  Acknowledgement,
  AcknowledgementReportFilters,
  AcknowledgementReportRow,
  AcknowledgementStatus,
  AppState,
  Script,
  ScriptType,
  ScriptVersion,
} from '../types';

export const acknowledgementStatusLabels: Record<AcknowledgementStatus, string> = {
  current: 'Current',
  outdated: 'Outdated',
  not_acknowledged: 'Not acknowledged',
  revoked: 'Revoked',
  superseded: 'Superseded',
};

export function formatApprovalDate(value: string | null | undefined): string {
  if (!value) return 'Unapproved';
  return new Date(value).toLocaleDateString();
}

export function getCurrentVersion(state: AppState, script: Script): ScriptVersion | null {
  if (!script.currentVersionId) return null;
  return state.scriptVersions.find((version) => version.id === script.currentVersionId) ?? null;
}

export function buildAcknowledgementTextSnapshot(script: Script, version: ScriptVersion): string {
  return `I have reviewed and understand ${script.title} version ${version.versionNumber}, approved on ${formatApprovalDate(version.approvedAt)}, and will use it as the current operating script.`;
}

export function resolveAcknowledgementStatus(
  acknowledgements: Acknowledgement[],
  staffId: string,
  script: Script
): { status: AcknowledgementStatus; acknowledgement: Acknowledgement | null; latestAcknowledgement: Acknowledgement | null } {
  const staffAcknowledgements = acknowledgements
    .filter((ack) => ack.staffId === staffId && ack.scriptId === script.id)
    .sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt));

  const currentAcknowledgement = staffAcknowledgements.find((ack) => ack.versionId === script.currentVersionId) ?? null;
  if (currentAcknowledgement?.revokedAt) {
    return { status: 'revoked', acknowledgement: currentAcknowledgement, latestAcknowledgement: currentAcknowledgement };
  }
  if (currentAcknowledgement && !currentAcknowledgement.supersededByVersionId) {
    return { status: 'current', acknowledgement: currentAcknowledgement, latestAcknowledgement: currentAcknowledgement };
  }

  const latestAcknowledgement = staffAcknowledgements[0] ?? null;
  if (!latestAcknowledgement) {
    return { status: 'not_acknowledged', acknowledgement: null, latestAcknowledgement: null };
  }
  if (latestAcknowledgement.revokedAt) {
    return { status: 'revoked', acknowledgement: latestAcknowledgement, latestAcknowledgement };
  }
  if (latestAcknowledgement.supersededByVersionId) {
    return { status: 'superseded', acknowledgement: latestAcknowledgement, latestAcknowledgement };
  }
  return { status: 'outdated', acknowledgement: latestAcknowledgement, latestAcknowledgement };
}

export function markScriptAcknowledgementsSuperseded(
  acknowledgements: Acknowledgement[],
  scriptId: string,
  newCurrentVersionId: string
): Acknowledgement[] {
  return acknowledgements.map((ack) => {
    if (ack.scriptId !== scriptId || ack.versionId === newCurrentVersionId || ack.revokedAt || ack.supersededByVersionId) {
      return ack;
    }
    return { ...ack, supersededByVersionId: newCurrentVersionId };
  });
}

export function buildAcknowledgementReportRows(state: AppState, filters: AcknowledgementReportFilters = {}): AcknowledgementReportRow[] {
  const activeStaff = state.staffMembers.filter((staff) => staff.active);
  const currentScripts = state.scripts.filter((script) => script.currentVersionId);

  const rows = activeStaff.flatMap((staff) => currentScripts.map((script) => {
    const room = state.rooms.find((candidate) => candidate.id === script.roomId) ?? null;
    const currentVersion = getCurrentVersion(state, script);
    const statusResult = resolveAcknowledgementStatus(state.acknowledgements, staff.id, script);
    return {
      roomId: script.roomId,
      roomName: room?.name ?? 'Unknown room',
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      permissionLevel: staff.permissionLevel ?? 'viewer',
      scriptId: script.id,
      scriptTitle: script.title,
      scriptType: script.scriptType,
      currentVersionId: script.currentVersionId,
      currentVersionNumber: currentVersion?.versionNumber ?? 'Unknown',
      approvalDate: currentVersion?.approvedAt ?? null,
      requiredBlocks: currentVersion?.requiredBlocks ?? [],
      status: statusResult.status,
      acknowledgementId: statusResult.acknowledgement?.id ?? null,
      acknowledgedAt: statusResult.acknowledgement?.acknowledgedAt ?? null,
      acknowledgementTextSnapshot: statusResult.acknowledgement?.acknowledgementTextSnapshot ?? null,
      source: statusResult.acknowledgement?.source ?? null,
      notes: statusResult.acknowledgement?.notes ?? '',
    } satisfies AcknowledgementReportRow;
  }));

  return rows.filter((row) => {
    if (filters.roomId && filters.roomId !== 'all' && row.roomId !== filters.roomId) return false;
    if (filters.staffId && filters.staffId !== 'all' && row.staffId !== filters.staffId) return false;
    if (filters.role && filters.role !== 'all' && row.staffRole !== filters.role) return false;
    if (filters.status && filters.status !== 'all' && row.status !== filters.status) return false;
    if (filters.scriptType && filters.scriptType !== 'all' && row.scriptType !== filters.scriptType) return false;
    return true;
  });
}

export function uniqueScriptTypes(rows: AcknowledgementReportRow[]): ScriptType[] {
  return Array.from(new Set(rows.map((row) => row.scriptType))).sort();
}
