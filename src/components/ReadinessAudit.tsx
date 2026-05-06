import { AlertTriangle, CheckCircle, Info, TrendingUp } from 'lucide-react';
import { AppState } from '../types';
import { runAudit } from '../lib/scriptAudit';

interface Props {
  state: AppState;
}

const severityConfig = {
  critical: { color: 'text-red-300', bg: 'bg-red-950/10', badge: 'bg-red-900/50 text-red-300 border-red-700/50', icon: AlertTriangle },
  warning: { color: 'text-amber-300', bg: '', badge: 'bg-amber-900/50 text-amber-300 border-amber-700/50', icon: AlertTriangle },
  improvement: { color: 'text-blue-300', bg: '', badge: 'bg-blue-900/50 text-blue-300 border-blue-700/50', icon: Info },
};

export default function ReadinessAudit({ state }: Props) {
  const auditResults = state.rooms.map((room) => ({ room, result: runAudit(state, room) }));
  const totalCritical = auditResults.reduce((s, a) => s + a.result.criticalCount, 0);
  const totalWarnings = auditResults.reduce((s, a) => s + a.result.warningCount, 0);
  const totalImprovements = auditResults.reduce((s, a) => s + a.result.improvementCount, 0);
  const avgScore = auditResults.length > 0 ? Math.round(auditResults.reduce((s, a) => s + a.result.score, 0) / auditResults.length) : 100;
  const scoreColor = avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400';
  const scoreLabel = avgScore >= 80 ? 'Ready for GM Delivery' : avgScore >= 60 ? 'Needs Attention' : 'Critical Issues Present';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Script Readiness Audit</h1>
        <p className="text-slate-400 text-sm mt-0.5">Deterministic checks across all rooms. Score deductions: -20 critical, -8 warning, -3 improvement.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 sm:col-span-1 bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-slate-500" /><span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Score</span></div>
          <div className={`text-4xl font-bold ${scoreColor}`}>{avgScore}</div>
          <div className={`text-xs mt-1 ${scoreColor} opacity-80`}>{scoreLabel}</div>
        </div>
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-5">
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Critical</div>
          <div className="text-3xl font-bold text-red-400">{totalCritical}</div>
          <div className="text-xs text-red-500 mt-1">-20 pts each</div>
        </div>
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-5">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Warnings</div>
          <div className="text-3xl font-bold text-amber-400">{totalWarnings}</div>
          <div className="text-xs text-amber-500 mt-1">-8 pts each</div>
        </div>
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-5">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Improvements</div>
          <div className="text-3xl font-bold text-blue-400">{totalImprovements}</div>
          <div className="text-xs text-blue-500 mt-1">-3 pts each</div>
        </div>
      </div>

      {auditResults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <CheckCircle className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No rooms to audit</p>
        </div>
      ) : (
        <div className="space-y-6">
          {auditResults.map(({ room, result }) => {
            const scoreClr = result.score >= 80 ? 'text-emerald-400' : result.score >= 60 ? 'text-amber-400' : 'text-red-400';
            const scoreBg = result.score >= 80 ? 'from-emerald-900/30 to-transparent' : result.score >= 60 ? 'from-amber-900/30 to-transparent' : 'from-red-900/30 to-transparent';
            return (
              <div key={room.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
                <div className={`flex items-center justify-between px-5 py-4 bg-gradient-to-r ${scoreBg}`}>
                  <div>
                    <h2 className="font-semibold text-slate-100">{room.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} · {result.criticalCount} critical · {result.warningCount} warning · {result.improvementCount} improvement</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${scoreClr}`}>{result.score}</div>
                    <div className="text-xs text-slate-500">/ 100</div>
                  </div>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {result.issues.length === 0 ? (
                    <div className="flex items-center gap-3 px-5 py-4 text-emerald-400"><CheckCircle className="w-4 h-4" /><span className="text-sm font-medium">All checks passed. Ready for GM delivery.</span></div>
                  ) : (
                    result.issues.map((issue) => {
                      const cfg = severityConfig[issue.severity];
                      const Icon = cfg.icon;
                      return (
                        <div key={issue.id} className={`px-5 py-4 ${cfg.bg}`}>
                          <div className="flex items-start gap-3">
                            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.badge}`}>{issue.severity}</span>
                                <span className="text-xs text-slate-500">{issue.category}</span>
                              </div>
                              <p className={`text-sm mt-1.5 ${cfg.color}`}>{issue.description}</p>
                              <p className="text-xs text-slate-500 mt-1"><span className="text-slate-400 font-medium">Fix:</span> {issue.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Audit Rules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
          {['Active room missing current pre-game briefing','Active room missing current safety briefing','Active room missing hint ladder coverage','Script family with no current approved version','Staff acknowledged older version, not current','Draft newer than current version pending review','Pronunciation term missing phonetic spelling','Hint ladder has only high-spoiler hints','Script not attached to any room','No staff have acknowledged any current scripts'].map((rule, i) => (
            <div key={i} className="flex items-start gap-2"><span className="text-slate-600 flex-shrink-0">{i + 1}.</span><span>{rule}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
