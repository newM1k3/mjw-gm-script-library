import { useState } from 'react';
import { CheckCircle, Clock, Archive, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { AppState } from '../types';

interface Props {
  state: AppState;
  onSetCurrentVersion: (scriptId: string, versionId: string) => void;
}

export default function VersionHistory({ state, onSetCurrentVersion }: Props) {
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [filterRoom, setFilterRoom] = useState('all');

  const filteredScripts = state.scripts.filter((s) => filterRoom === 'all' || s.roomId === filterRoom);

  const approvalColors: Record<string, string> = {
    approved: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
    draft: 'text-slate-400 bg-slate-700/30 border-slate-600/40',
    in_review: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
    rejected: 'text-red-400 bg-red-900/30 border-red-700/40',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Version History</h1>
          <p className="text-slate-400 text-sm mt-0.5">View all script versions, mark current, and review change summaries.</p>
        </div>
        <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
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
            const isExpanded = expandedScript === script.id;
            const room = state.rooms.find((r) => r.id === script.roomId);
            return (
              <div key={script.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedScript(isExpanded ? null : script.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/40 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-100">{script.title}</span>
                      {script.currentVersionId && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-900/40 text-emerald-300 border-emerald-700/50"><Star className="w-3 h-3" /> Current</span>
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
                        const isCurrent = version.id === script.currentVersionId;
                        return (
                          <div key={version.id} className={`px-5 py-4 ${isCurrent ? 'bg-emerald-950/20' : ''}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-slate-200">v{version.versionNumber}</span>
                                  {isCurrent && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-emerald-900/40 text-emerald-300 border-emerald-700/50"><CheckCircle className="w-3 h-3" /> Current Approved</span>}
                                  <span className={`text-xs px-2 py-0.5 rounded border ${approvalColors[version.approvalStatus] ?? approvalColors.draft}`}>{version.approvalStatus}</span>
                                  {!isCurrent && version.approvalStatus === 'approved' && <span className="flex items-center gap-1 text-xs text-slate-500"><Archive className="w-3 h-3" /> archived</span>}
                                </div>
                                <div className="mt-1.5 text-xs text-slate-400 space-y-0.5">
                                  <div>{version.changeSummary}</div>
                                  {version.toneNotes && <div className="text-slate-500">Tone: {version.toneNotes}</div>}
                                  <div className="text-slate-600">{version.approvedBy && `Approved by ${version.approvedBy} · `}{new Date(version.createdAt).toLocaleDateString()}</div>
                                </div>
                                {version.requiredBlocks.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {version.requiredBlocks.map((b) => <span key={b} className="text-xs px-1.5 py-0.5 bg-slate-700/50 border border-slate-600/50 rounded text-slate-400">{b}</span>)}
                                  </div>
                                )}
                              </div>
                              {!isCurrent && (
                                <button onClick={() => onSetCurrentVersion(script.id, version.id)} className="flex-shrink-0 px-3 py-1.5 text-xs bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 rounded-lg hover:bg-emerald-800/50 transition-colors">Make Current</button>
                              )}
                            </div>
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
