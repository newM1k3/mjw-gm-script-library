import { Acknowledgement, AppState, Script, ScriptVersion } from '../types';

export type VersionGovernanceAction = 'submit' | 'approve' | 'reject' | 'make-current' | 'archive' | 'rollback';

export interface VersionDiffLine {
  lineNumber: number;
  status: 'unchanged' | 'added' | 'removed' | 'changed';
  currentText: string;
  candidateText: string;
}

export interface SafetyValidationResult {
  valid: boolean;
  missingRequiredBlocks: string[];
  checksumChanged: boolean;
  checksum: string;
  expectedChecksum?: string;
}

export interface AcknowledgementImpactSummary {
  currentAcknowledgements: Acknowledgement[];
  impactedStaffIds: string[];
  impactedCount: number;
}

export function getCurrentVersionForScript(state: AppState, script: Script): ScriptVersion | null {
  if (!script.currentVersionId) return null;
  return state.scriptVersions.find((version) => version.id === script.currentVersionId) ?? null;
}

export function getVersionLifecycleStatus(script: Script, version: ScriptVersion): 'draft' | 'in_review' | 'approved' | 'rejected' | 'current' | 'archived' {
  if (version.id === script.currentVersionId) return 'current';
  if (version.approvalStatus === 'current') return 'current';
  if (version.approvalStatus === 'archived') return 'archived';
  if (version.approvalStatus === 'approved') return 'approved';
  if (version.approvalStatus === 'rejected') return 'rejected';
  if (version.approvalStatus === 'in_review') return 'in_review';
  return 'draft';
}

export function lifecycleLabel(status: ReturnType<typeof getVersionLifecycleStatus>): string {
  return status.replace('_', ' ');
}

export function normalizeSafetyText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function calculateSafetyBlockChecksum(requiredBlocks: string[], bodyMarkdown: string): string {
  const payload = `${requiredBlocks.map((block) => block.trim().toLowerCase()).sort().join('|')}::${normalizeSafetyText(bodyMarkdown)}`;
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function validateSafetyBlocks(version: ScriptVersion, previousVersion?: ScriptVersion | null): SafetyValidationResult {
  const normalizedBody = normalizeSafetyText(version.bodyMarkdown);
  const missingRequiredBlocks = version.requiredBlocks.filter((block) => {
    const normalizedBlock = normalizeSafetyText(block);
    return normalizedBlock.length > 0 && !normalizedBody.includes(normalizedBlock);
  });
  const checksum = calculateSafetyBlockChecksum(version.requiredBlocks, version.bodyMarkdown);
  const expectedChecksum = version.safetyBlockChecksum || previousVersion?.safetyBlockChecksum;
  return {
    valid: missingRequiredBlocks.length === 0,
    missingRequiredBlocks,
    checksumChanged: Boolean(expectedChecksum && expectedChecksum !== checksum),
    checksum,
    expectedChecksum,
  };
}

export function buildVersionDiff(currentVersion: ScriptVersion | null, candidateVersion: ScriptVersion): VersionDiffLine[] {
  const currentLines = (currentVersion?.bodyMarkdown ?? '').split('\n');
  const candidateLines = candidateVersion.bodyMarkdown.split('\n');
  const maxLines = Math.max(currentLines.length, candidateLines.length);
  const rows: VersionDiffLine[] = [];
  for (let index = 0; index < maxLines; index += 1) {
    const currentText = currentLines[index] ?? '';
    const candidateText = candidateLines[index] ?? '';
    let status: VersionDiffLine['status'] = 'unchanged';
    if (currentText && !candidateText) status = 'removed';
    else if (!currentText && candidateText) status = 'added';
    else if (currentText !== candidateText) status = 'changed';
    rows.push({ lineNumber: index + 1, status, currentText, candidateText });
  }
  return rows;
}

export function summarizeVersionDiff(currentVersion: ScriptVersion | null, candidateVersion: ScriptVersion): Record<VersionDiffLine['status'], number> {
  return buildVersionDiff(currentVersion, candidateVersion).reduce(
    (summary, line) => ({ ...summary, [line.status]: summary[line.status] + 1 }),
    { unchanged: 0, added: 0, removed: 0, changed: 0 }
  );
}

export function getAcknowledgementImpact(state: AppState, scriptId: string, newCurrentVersionId: string): AcknowledgementImpactSummary {
  const currentAcknowledgements = state.acknowledgements.filter(
    (ack) => ack.scriptId === scriptId && ack.versionId !== newCurrentVersionId && !ack.revokedAt && !ack.supersededByVersionId
  );
  const impactedStaffIds = Array.from(new Set(currentAcknowledgements.map((ack) => ack.staffId)));
  return { currentAcknowledgements, impactedStaffIds, impactedCount: impactedStaffIds.length };
}

export function canMakeVersionCurrent(version: ScriptVersion): boolean {
  return version.approvalStatus === 'approved' || version.approvalStatus === 'current';
}
