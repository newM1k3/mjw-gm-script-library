import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle, ChevronDown, ChevronUp, Clock, GitCompare, Send, ShieldCheck, Star, XCircle } from 'lucide-react';
import { AppState, ScriptVersion } from '../types';
import { AuthUser, canApproveVersions } from '../lib/auth';
import { useToast } from '../lib/useToast';
import {
  buildVersionDiff,
  canMakeVersionCurrent,
  getAcknowledgementImpact,
  getCurrentVersionForScript,
  getVersionLifecycleStatus,
  lifecycleLabel,
  validateSafetyBlocks,
  VersionGovernanceAction,
} from '../lib/versionGovernance';

interface Props {
  state: AppState;
  currentUser: AuthUser | null;
  onSetCurrentVersion: (scriptId: string, versionId: string) => void;
  onUpdateVersionGovernance: (versionId: string, action: VersionGovernanceAction, notes?: string) => void;
}

interface PendingMakeCurrent {
  scriptId: string;
  versionId: string;
  versionNumber: string;
  scriptTitle: string;
  impactedStaffIds: string[];
  impactedCount: number;
}

const lifecycleColors: Record<string, string> = {
  current: 'text-emerald-300 bg-emerald-900/40 border-emerald-700/50',
  approved: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  archived: 'text-slate-400 bg-slate-700/30 border-slate-600/40',
  draft: 'text-slate-400 bg-slate-700/30 border-slate-600/40',
  in_review: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
  rejected: 'text-red-400 bg-red-900/30 border-red-700/40',
};

function VersionDiffViewer({ currentVersion, candidateVersion }: { currentVersion: ScriptVersion | null; candidateVersion: ScriptVersion }) {
  const diffRows = useMemo(() => buildVersionDiff(currentVersion, candidateVersion), [currentVersion, candidateVersion]);
  const changedRows = diffRows.filter((row) => row.status !== 'unchanged');
  const visibleRows = changedRows.length > 0 ? changedRows : diffRows.slice(0, 12);

  return (
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 overflow-hidden">
      <div className="grid grid-cols-[4rem_1fr_1fr] gap-0 border-b border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Line</span>
        <span>Current version</span>
        <span>Selected version</span>
      </div>
      {visibleRows.length === 0 ? (
        <div className="px-3 py-3 text-xs text-slate-500">No text differences found.</div>
      ) : (
        <div className="max-h-80 overflow-auto divide-y divide-slate-800">
          {visibleRows.map((row) => (
            <div key={`${candidateVersion.id}_${row.lineNumber}`} className={`grid grid-cols-[4rem_1fr_1fr] gap-0 px-3 py-2 text-xs ${row.status === 'added' ? 'bg-emerald-950/20' : row.status === 'removed' ? 'bg-red-950/20' : row.status === 'changed' ? 'bg-amber-950/20' : ''}`}>
              <span className="font-mono text-slate-600">{row.lineNumber}</span>
              <pre className="whitespace-pre-wrap pr-3 font-mono text-slate-400">{row.currentText || '—'}</pre>
              <pre className="whitespace-pre-wrap font-mono text-slate-200">{row.candidateText || '—'}</pre>
            </div>
          ))}
        </div>
      )}
      {changedRows.length === 0 && diffRows.length > 12 && <div className="px-3 py-2 text-xs text-slate-600">Showing first 12 unchanged lines.</div>}
    </div>
  );
}

export default function VersionHistory({ state, currentUser, onSetCurrentVersion, onUpdateVersionGovernance }: Props) {
  const { toast } = useToast();
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [filterRoom, setFilterRoom] = useState('all');
  const [pendingMakeCurrent, setPendingMakeCurrent] = useState<PendingMakeCurrent | null>(null);
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const canApprove = canApproveVersions(currentUser);

  const filteredScripts = state.scripts.filter((s) => filterRoom === 'all' || s.roomId === filterRoom);

  function requestMakeCurrent(scriptId: string, version: ScriptVersion, scriptTitle: string) {
    if (!canApprove) {
      toast('Manager or Owner permission is required to make a version current.');
      return;
    }
    if (!canMakeVersionCurrent(version)) {
      toast('Only approved versions can become current. Submit and approve this version first.');
      return;
    }
    const impact = getAcknowledgementImpact(state, scriptId, version.id);
    setPendingMakeCurrent({ scriptId, versionId: version.id, versionNumber: version.versionNumber, scriptTitle, impactedStaffIds: impact.impactedStaffIds, impactedCount: impact.impactedCount });
  }

  function handleMakeCurrentConfirmed() {
    if (!pendingMakeCurrent) return;
    onSetCurrentVersion(pendingMakeCurrent.scriptId, pendingMakeCurrent.versionId);
    toast(`v${pendingMakeCurrent.versionNumber} is now the current version. ${pendingMakeCurrent.impactedCount} staff readiness record${pendingMakeCurrent.impactedCount === 1 ? '' : 's'} impacted.`);
    setPendingMakeCurrent(null);
  }

  function handleGovernanceAction(version: ScriptVersion, action: VersionGovernanceAction) {
    if (!canApprove && action !== 'submit') {
      toast('Manager or Owner permission is required for this governance action.');
      return;
    }
    if (action === 'approve') {
      if (!currentUser) {
        toast('Approver identity is required before a version can be approved.');
        return;
      }
      const previousVersion = version.previousVersionId ? state.scriptVersions.find((candidate) => candidate.id === version.previousVersionId) ?? null : null;
      const safety = validateSafetyBlocks(version, previousVersion);
      if (!safety.valid) {
        toast(`Approval blocked. Required safety blocks are missing from the body: ${safety.missingRequiredBlocks.join(', ')}`);
        return;
      }
      if (safety.checksumChanged) {
        toast('Safety-block checksum changed. Review the diff before approving this version.');
      }
    }
    onUpdateVersionGovernance(version.id, action);
    toast(`${action.replace('-', ' ')} recorded for v${version.versionNumber}`);
  }

  return (
    <div className="space-y-6">
      {pendingMakeCurrent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="make-current-title">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 id="make-current-title" className="text-lg font-semibold text-slate-100">Make v{pendingMakeCurrent.versionNumber} Current?</h2>
              <p className="mt-1 text-sm text-slate-400">This will publish “{pendingMakeCurrent.scriptTitle}” as the current operating script.</p>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-slate-300">
              <div className="flex items-start gap-2 rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{pendingMakeCurrent.impactedCount} staff member{pendingMakeCurrent.impactedCount === 1 ? '' : 's'} will need to re-acknowledge this script because prior acknowledgements will become outdated or superseded.</span>
              </div>
              {pendingMakeCurrent.impactedStaffIds.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Impacted staff</div>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingMakeCurrent.impactedStaffIds.map((staffId) => {
                      const staff = state.staffMembers.find((member) => member.id === staffId);
                      return <span key={staffId} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{staff?.name ?? staffId}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
              <button onClick={() => setPendingMakeCurrent(null)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={handleMakeCurrentConfirmed} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600">Make Current</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Version Governance</h1>
          <p className="text-slate-400 text-sm mt-0.5">Review diffs, validate safety blocks, approve versions, and control what becomes operationally current.</p>
        </div>
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
        >
          <option value="all">All Rooms</option>
          {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {filteredScripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <Clock className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No scripts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredScripts.map((script) => {
            const versions = state.scriptVersions.filter((v) => v.scriptId === script.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            const currentVersion = getCurrentVersionForScript(state, script);
            const isExpanded = expandedScript === script.id;
            const room = state.rooms.find((r) => r.id === script.roomId);
            return (
              <div key={script.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedScript(isExpanded ? null : script.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} versions for ${script.title}`}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/40 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-100">{script.title}</span>
                      {currentVersion && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-900/40 text-emerald-300 border-emerald-700/50">
                          <Star className="w-3 h-3" /> Current v{currentVersion.versionNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{room?.name ?? 'Unassigned'} · {versions.length} version{versions.length !== 1 ? 's' : ''}</div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 ml-4" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-4" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700/60 divide-y divide-slate-700/40">
                    {versions.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-slate-500">No versions created yet.</div>
                    ) : (
                      versions.map((version) => {
                        const lifecycleStatus = getVersionLifecycleStatus(script, version);
                        const isCurrent = lifecycleStatus === 'current';
                        const safety = validateSafetyBlocks(version, currentVersion);
                        return (
                          <div key={version.id} className={`px-5 py-4 ${isCurrent ? 'bg-emerald-950/20' : ''}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-slate-200">v{version.versionNumber}</span>
                                  {isCurrent && (
                                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-900/40 text-emerald-300 border-emerald-700/50">
                                      <CheckCircle className="w-3 h-3" /> Current
                                    </span>
                                  )}
                                  <span className={`text-xs px-2 py-0.5 rounded border ${lifecycleColors[lifecycleStatus] ?? lifecycleColors.draft}`}>{lifecycleLabel(lifecycleStatus)}</span>
                                  {!safety.valid && <span className="flex items-center gap-1 text-xs text-red-300"><AlertTriangle className="w-3 h-3" /> safety blocked</span>}
                                  {safety.checksumChanged && <span className="flex items-center gap-1 text-xs text-amber-300"><ShieldCheck className="w-3 h-3" /> checksum changed</span>}
                                  {lifecycleStatus === 'archived' && <span className="flex items-center gap-1 text-xs text-slate-500"><Archive className="w-3 h-3" /> archived</span>}
                                </div>
                                <div className="mt-1.5 text-xs text-slate-400 space-y-0.5">
                                  <div>{version.changeSummary}</div>
                                  {version.toneNotes && <div className="text-slate-500">Tone: {version.toneNotes}</div>}
                                  <div className="text-slate-600">{version.approvedBy && `Approved by ${version.approvedBy} · `}{version.approvedAt ? new Date(version.approvedAt).toLocaleDateString() : new Date(version.createdAt).toLocaleDateString()}</div>
                                </div>
                                {version.requiredBlocks.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {version.requiredBlocks.map((block) => (
                                      <span key={block} className={`text-xs px-1.5 py-0.5 border rounded ${safety.missingRequiredBlocks.includes(block) ? 'bg-red-900/40 border-red-700/50 text-red-200' : 'bg-slate-700/50 border-slate-600/50 text-slate-400'}`}>{block}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-shrink-0 flex-col gap-2">
                                <button onClick={() => setDiffVersionId(diffVersionId === version.id ? null : version.id)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                                  <GitCompare className="h-3 w-3" /> Diff
                                </button>
                                {lifecycleStatus === 'draft' && (
                                  <button onClick={() => handleGovernanceAction(version, 'submit')} className="flex items-center justify-center gap-1 rounded-lg border border-blue-700/50 bg-blue-900/30 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-800/40">
                                    <Send className="h-3 w-3" /> Submit
                                  </button>
                                )}
                                {lifecycleStatus === 'in_review' && (
                                  <>
                                    <button onClick={() => handleGovernanceAction(version, 'approve')} className="flex items-center justify-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-800/40">
                                      <CheckCircle className="h-3 w-3" /> Approve
                                    </button>
                                    <button onClick={() => handleGovernanceAction(version, 'reject')} className="flex items-center justify-center gap-1 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-800/40">
                                      <XCircle className="h-3 w-3" /> Reject
                                    </button>
                                  </>
                                )}
                                {!isCurrent && (
                                  <button
                                    onClick={() => requestMakeCurrent(script.id, version, script.title)}
                                    aria-label={`Make v${version.versionNumber} current for ${script.title}`}
                                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${canApprove && canMakeVersionCurrent(version) ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/50' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}
                                  >
                                    Make Current
                                  </button>
                                )}
                                {lifecycleStatus === 'approved' && (
                                  <button onClick={() => handleGovernanceAction(version, 'archive')} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700">Archive</button>
                                )}
                              </div>
                            </div>
                            {diffVersionId === version.id && <VersionDiffViewer currentVersion={currentVersion} candidateVersion={version} />}
                            <details className="mt-3">
                              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors">View script content</summary>
                              <pre className="mt-2 p-3 bg-slate-900/60 rounded-lg text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-auto max-h-64">{version.bodyMarkdown}</pre>
                            </details>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
