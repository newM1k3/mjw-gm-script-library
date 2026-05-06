import {
  BookOpen, Clock, AlertTriangle, CheckCircle, Users, ChevronRight,
  TrendingUp, FileText, Mic, Star,
} from 'lucide-react';
import { AppState } from '../types';
import { runAudit } from '../lib/scriptAudit';

interface Props {
  state: AppState;
  onNavigate: (screen: string) => void;
}

export default function Dashboard({ state, onNavigate }: Props) {
  const activeRooms = state.rooms.filter((r) => r.status === 'active').length;
  const currentScripts = state.scripts.filter((s) => s.currentVersionId).length;

  const auditResults = state.rooms.map((room) => runAudit(state, room));
  const avgScore =
    auditResults.length > 0
      ? Math.round(auditResults.reduce((sum, r) => sum + r.score, 0) / auditResults.length)
      : 100;

  const totalCritical = auditResults.reduce((sum, r) => sum + r.criticalCount, 0);
  const totalWarnings = auditResults.reduce((sum, r) => sum + r.warningCount, 0);

  const pendingAcks = state.staffMembers
    .filter((s) => s.active)
    .reduce((count, staff) => {
      const currentScriptsList = state.scripts.filter((s) => s.currentVersionId);
      const missing = currentScriptsList.filter(
        (script) =>
          !state.acknowledgements.some(
            (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId
          )
      );
      return count + missing.length;
    }, 0);

  const scoreColor = avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400';
  const scoreBg = avgScore >= 80 ? 'from-emerald-900/40 to-emerald-800/20' : avgScore >= 60 ? 'from-amber-900/40 to-amber-800/20' : 'from-red-900/40 to-red-800/20';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">GM Script Library</h1>
        <p className="mt-1 text-slate-400 text-sm">Script consistency and delivery control for escape-room operators</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`bg-gradient-to-br ${scoreBg} border border-slate-700/60 rounded-xl p-5 cursor-pointer hover:border-slate-600 transition-colors`} onClick={() => onNavigate('audit')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Readiness Score</span>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>
          <div className={`text-4xl font-bold ${scoreColor}`}>{avgScore}</div>
          <div className="text-xs text-slate-400 mt-1">out of 100 · across all rooms</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 cursor-pointer hover:border-slate-600 transition-colors" onClick={() => onNavigate('rooms')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Rooms</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-4xl font-bold text-slate-100">{activeRooms}</div>
          <div className="text-xs text-slate-400 mt-1">active · {state.rooms.length} total</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 cursor-pointer hover:border-slate-600 transition-colors" onClick={() => onNavigate('scripts')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Scripts</span>
            <BookOpen className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-4xl font-bold text-slate-100">{currentScripts}</div>
          <div className="text-xs text-slate-400 mt-1">current · {state.scripts.length} total</div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 cursor-pointer hover:border-slate-600 transition-colors" onClick={() => onNavigate('acknowledgements')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pending Acks</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className={`text-4xl font-bold ${pendingAcks > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{pendingAcks}</div>
          <div className="text-xs text-slate-400 mt-1">staff acknowledgements outstanding</div>
        </div>
      </div>

      {(totalCritical > 0 || totalWarnings > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {totalCritical > 0 && (
            <div className="flex items-start gap-3 bg-red-950/40 border border-red-800/50 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-red-300 text-sm">{totalCritical} Critical {totalCritical === 1 ? 'Issue' : 'Issues'}</div>
                <div className="text-xs text-red-400/80 mt-0.5">Active rooms are missing required scripts. Review the Audit screen.</div>
              </div>
              <button onClick={() => onNavigate('audit')} className="text-red-400 hover:text-red-300 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {totalWarnings > 0 && (
            <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/50 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-amber-300 text-sm">{totalWarnings} {totalWarnings === 1 ? 'Warning' : 'Warnings'}</div>
                <div className="text-xs text-amber-400/80 mt-0.5">Some scripts or acknowledgements need attention.</div>
              </div>
              <button onClick={() => onNavigate('audit')} className="text-amber-400 hover:text-amber-300 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Rooms</h2>
          <button onClick={() => onNavigate('rooms')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            Manage Rooms <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.rooms.map((room) => {
            const audit = auditResults.find((r) => r.roomId === room.id);
            const roomScripts = state.scripts.filter((s) => s.roomId === room.id);
            const roomCurrent = roomScripts.filter((s) => s.currentVersionId).length;
            const score = audit?.score ?? 100;
            const scoreClr = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
            const statusColors: Record<string, string> = {
              active: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
              inactive: 'bg-slate-700/50 text-slate-400 border-slate-600/50',
              maintenance: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
              retired: 'bg-red-900/50 text-red-400 border-red-800/50',
            };
            return (
              <div key={room.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-100 text-base leading-tight">{room.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{room.theme}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${statusColors[room.status] ?? statusColors.inactive}`}>{room.status}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {room.durationMinutes}m</span>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {room.difficulty}</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {roomCurrent} scripts</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${scoreClr}`}>{score}</span>
                    <span className="text-xs text-slate-500">readiness</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onNavigate('gm')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-900/50 border border-blue-700/50 rounded-lg text-xs text-blue-300 hover:bg-blue-800/60 transition-colors">
                      <Mic className="w-3 h-3" /> GM Mode
                    </button>
                    <button onClick={() => onNavigate('audit')} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-xs text-slate-300 hover:bg-slate-600/50 transition-colors">
                      Audit <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {state.rooms.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 bg-slate-800/40 border border-dashed border-slate-700 rounded-xl">
              <Clock className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">No rooms yet</p>
              <button onClick={() => onNavigate('rooms')} className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">Add Room</button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Script Library', icon: BookOpen, screen: 'scripts' },
            { label: 'Script Editor', icon: FileText, screen: 'editor' },
            { label: 'GM Mode', icon: Mic, screen: 'gm' },
            { label: 'Hint Ladders', icon: TrendingUp, screen: 'hints' },
            { label: 'Audit', icon: CheckCircle, screen: 'audit' },
            { label: 'Export', icon: AlertTriangle, screen: 'export' },
          ].map(({ label, icon: Icon, screen }) => (
            <button key={screen} onClick={() => onNavigate(screen)} className="flex flex-col items-center gap-2 p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:border-slate-600 hover:bg-slate-700/60 transition-all group">
              <Icon className="w-5 h-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
              <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors font-medium text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Future Integration Placeholders</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
          <div className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span><span><span className="text-slate-400 font-medium">RoomReady Ops:</span> Convert script acknowledgements into pre-shift readiness tasks.</span></div>
          <div className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span><span><span className="text-slate-400 font-medium">Puzzle Flow Visualizer:</span> Import flow stages to scaffold hint ladder entries.</span></div>
          <div className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span><span><span className="text-slate-400 font-medium">PocketBase:</span> Production persistence via <code className="text-slate-400">VITE_POCKETBASE_URL</code>.</span></div>
          <div className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">→</span><span><span className="text-slate-400 font-medium">AI Script Rewriting:</span> Netlify function for tone rewriting without altering safety blocks.</span></div>
        </div>
      </div>
    </div>
  );
}
