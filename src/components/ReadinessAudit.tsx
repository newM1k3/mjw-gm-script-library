import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, FileJson, Filter, Info, Navigation, ShieldCheck, TrendingUp } from 'lucide-react';

import { AppState, IssueSeverity, ReadinessAuditFilters, ReadinessIssueCategory, ReadinessIssueStatus, ScriptReadinessIssue } from '../types';
import { runAllAudits, runGlobalAuditIssues } from '../lib/scriptAudit';
import { downloadFile, exportReadinessJSON, exportReadinessMarkdown } from '../services/exporters';
import { useToast } from '../lib/useToast';

interface Props {
  state: AppState;
  onNavigate: (screen: string) => void;
}

type DecoratedIssue = ScriptReadinessIssue & { roomName: string; score: number };

const severityConfig: Record<IssueSeverity, { color: string; bg: string; badge: string; icon: typeof AlertTriangle }> = {
  critical: { color: 'text-red-300', bg: 'bg-red-950/10', badge: 'bg-red-900/50 text-red-300 border-red-700/50', icon: AlertTriangle },
  warning: { color: 'text-amber-300', bg: 'bg-amber-950/10', badge: 'bg-amber-900/50 text-amber-300 border-amber-700/50', icon: AlertTriangle },
  improvement: { color: 'text-blue-300', bg: 'bg-blue-950/10', badge: 'bg-blue-900/50 text-blue-300 border-blue-700/50', icon: Info },
};

const categoryLabels: Record<ReadinessIssueCategory, string> = {
  room: 'Room Setup',
  script: 'Scripts',
  staff: 'Staff Acknowledgements',
  hint: 'Hint Ladders',
  pronunciation: 'Pronunciation',
};

const statusLabels: Record<ReadinessIssueStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
};

function scoreClasses(score: number) {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'from-emerald-900/30 to-transparent', label: 'Ready for GM Delivery' };
  if (score >= 60) return { text: 'text-amber-400', bg: 'from-amber-900/30 to-transparent', label: 'Needs Attention' };
  return { text: 'text-red-400', bg: 'from-red-900/30 to-transparent', label: 'Critical Issues Present' };
}

function filenameTimestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export default function ReadinessAudit({ state, onNavigate }: Props) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReadinessAuditFilters>({
    severity: 'all',
    roomId: 'all',
    category: 'all',
    status: 'all',
  });

  const auditResults = useMemo(() => runAllAudits(state), [state]);
  const globalIssues = useMemo(() => runGlobalAuditIssues(state), [state]);

  const decoratedIssues: DecoratedIssue[] = useMemo(() => [
    ...auditResults.flatMap(({ roomId, score, issues }) => {
      const room = state.rooms.find((candidate) => candidate.id === roomId);
      return issues.map((issue) => ({ ...issue, roomName: room?.name ?? 'Unknown room', score }));
    }),
    ...globalIssues.map((issue) => ({ ...issue, roomName: 'Global Library', score: 0 })),
  ], [auditResults, globalIssues, state.rooms]);

  const filteredIssues = decoratedIssues.filter((issue) => {
    const severityMatch = filters.severity === 'all' || !filters.severity || issue.severity === filters.severity;
    const roomMatch = filters.roomId === 'all' || !filters.roomId || issue.roomId === filters.roomId;
    const categoryMatch = filters.category === 'all' || !filters.category || issue.category === filters.category;
    const statusMatch = filters.status === 'all' || !filters.status || issue.status === filters.status;
    return severityMatch && roomMatch && categoryMatch && statusMatch;
  });

  const totalCritical = decoratedIssues.filter((issue) => issue.severity === 'critical').length;
  const totalWarnings = decoratedIssues.filter((issue) => issue.severity === 'warning').length;
  const totalImprovements = decoratedIssues.filter((issue) => issue.severity === 'improvement').length;
  const avgScore = auditResults.length > 0 ? Math.round(auditResults.reduce((sum, audit) => sum + audit.score, 0) / auditResults.length) : 100;
  const overallScore = scoreClasses(avgScore);
  const generatedAt = auditResults[0]?.generatedAt ?? new Date().toISOString();
  const dataSource = auditResults[0]?.dataSource ?? 'local';

  function updateFilter<K extends keyof ReadinessAuditFilters>(key: K, value: ReadinessAuditFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ severity: 'all', roomId: 'all', category: 'all', status: 'all' });
  }

  function handleDownload(format: 'markdown' | 'json') {
    const timestamp = filenameTimestamp();
    if (format === 'json') {
      downloadFile(exportReadinessJSON(state, auditResults, globalIssues), `readiness-audit-${timestamp}.json`, 'application/json');
    } else {
      downloadFile(exportReadinessMarkdown(state, auditResults, globalIssues), `readiness-audit-${timestamp}.md`, 'text/markdown');
    }
    toast(`Readiness audit ${format.toUpperCase()} export downloaded.`, 'success');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Script Readiness Audit</h1>
          <p className="text-slate-400 text-sm mt-0.5">Actionable operational checks across rooms, scripts, staff acknowledgements, hint ladders, and pronunciation records.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">Generated {new Date(generatedAt).toLocaleString()}</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">Data source: {dataSource}</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">Score deductions: -20 critical · -8 warning · -3 improvement</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleDownload('markdown')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            <Download className="h-4 w-4" /> Markdown
          </button>
          <button
            type="button"
            onClick={() => handleDownload('json')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            <FileJson className="h-4 w-4" /> JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 sm:col-span-1 bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-slate-500" /><span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Score</span></div>
          <div className={`text-4xl font-bold ${overallScore.text}`}>{avgScore}</div>
          <div className={`text-xs mt-1 ${overallScore.text} opacity-80`}>{overallScore.label}</div>
        </div>
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-5">
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Critical</div>
          <div className="text-3xl font-bold text-red-400">{totalCritical}</div>
          <div className="text-xs text-red-500 mt-1">Immediate blockers</div>
        </div>
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-5">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Warnings</div>
          <div className="text-3xl font-bold text-amber-400">{totalWarnings}</div>
          <div className="text-xs text-amber-500 mt-1">Operational risk</div>
        </div>
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-5">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Improvements</div>
          <div className="text-3xl font-bold text-blue-400">{totalImprovements}</div>
          <div className="text-xs text-blue-500 mt-1">Quality upgrades</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300"><Filter className="h-4 w-4 text-slate-500" /> Issue filters</div>
          <button type="button" onClick={resetFilters} className="text-xs text-slate-500 hover:text-slate-300">Reset filters</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-slate-500">
            Severity
            <select value={filters.severity ?? 'all'} onChange={(event) => updateFilter('severity', event.target.value as ReadinessAuditFilters['severity'])} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="improvement">Improvement</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-500">
            Room
            <select value={filters.roomId ?? 'all'} onChange={(event) => updateFilter('roomId', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <option value="all">All rooms</option>
              {state.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              {globalIssues.length > 0 && <option value="global">Global Library</option>}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-500">
            Category
            <select value={filters.category ?? 'all'} onChange={(event) => updateFilter('category', event.target.value as ReadinessAuditFilters['category'])} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <option value="all">All categories</option>
              {(Object.keys(categoryLabels) as ReadinessIssueCategory[]).map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-500">
            Status
            <select value={filters.status ?? 'all'} onChange={(event) => updateFilter('status', event.target.value as ReadinessAuditFilters['status'])} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <option value="all">All statuses</option>
              {(Object.keys(statusLabels) as ReadinessIssueStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
        </div>
      </div>

      {auditResults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <CheckCircle className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No rooms to audit</p>
          {globalIssues.length > 0 && <p className="mt-2 text-xs text-slate-500">Global library issues are listed below.</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {auditResults.map((result) => {
            const room = state.rooms.find((candidate) => candidate.id === result.roomId);
            if (!room) return null;
            const classes = scoreClasses(result.score);
            return (
              <section key={room.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
                <div className={`flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-r ${classes.bg}`}>
                  <div>
                    <h2 className="font-semibold text-slate-100">{room.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} · {result.criticalCount} critical · {result.warningCount} warning · {result.improvementCount} improvement</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${classes.text}`}>{result.score}</div>
                    <div className="text-xs text-slate-500">/ 100</div>
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-700/50 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open remediation queue</h3>
                    {result.issues.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-emerald-300"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">All checks passed. Ready for GM delivery.</span></div>
                    ) : (
                      result.issues.map((issue) => {
                        const cfg = severityConfig[issue.severity];
                        const Icon = cfg.icon;
                        return (
                          <div key={issue.id} className={`rounded-lg border border-slate-700/50 px-4 py-3 ${cfg.bg}`}>
                            <div className="flex items-start gap-3">
                              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.badge}`}>{issue.severity}</span>
                                  <span className="text-xs text-slate-500">{categoryLabels[issue.category]}</span>
                                  <span className="text-xs text-slate-600">{statusLabels[issue.status]}</span>
                                </div>
                                <p className={`text-sm font-medium mt-1.5 ${cfg.color}`}>{issue.title}</p>
                                <p className="text-sm text-slate-300 mt-1">{issue.description}</p>
                                <p className="text-xs text-slate-500 mt-1"><span className="text-slate-400 font-medium">Fix:</span> {issue.recommendation}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onNavigate(issue.remediation.screen)}
                                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                              >
                                <Navigation className="h-3.5 w-3.5" /> {issue.remediation.label}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Room readiness checklist</h3>
                    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 divide-y divide-slate-800">
                      {result.checklist.map((item) => (
                        <div key={item.id} className="flex gap-3 px-4 py-3">
                          {item.complete ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />}
                          <div>
                            <p className="text-sm font-medium text-slate-200">{item.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/50">
        <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Filtered issue worklist</h2>
            <p className="text-xs text-slate-500 mt-1">{filteredIssues.length} of {decoratedIssues.length} issues match the selected filters.</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-slate-600" />
        </div>
        <div className="divide-y divide-slate-700/50">
          {filteredIssues.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-500">No issues match the current filters.</div>
          ) : (
            filteredIssues.map((issue) => {
              const cfg = severityConfig[issue.severity];
              return (
                <div key={`${issue.roomId}-${issue.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.badge}`}>{issue.severity}</span>
                      <span className="text-xs text-slate-500">{issue.roomName}</span>
                      <span className="text-xs text-slate-600">{categoryLabels[issue.category]}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-slate-200">{issue.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{issue.recommendation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(issue.remediation.screen)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    <Navigation className="h-3.5 w-3.5" /> {issue.remediation.label}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
