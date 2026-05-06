import { useState } from 'react';
import { Plus, Search, Filter, FileText, ChevronRight, Tag } from 'lucide-react';
import { AppState, Script, ScriptStatus, ScriptType } from '../types';

interface Props {
  state: AppState;
  onNavigateToEditor: (scriptId?: string) => void;
}

const scriptTypeLabels: Record<ScriptType, string> = {
  pre_game_brief: 'Pre-Game Brief', safety_brief: 'Safety Brief', story_intro: 'Story Intro',
  character_intro: 'Character Intro', hint_ladder: 'Hint Ladder', mid_game_intervention: 'Mid-Game Intervention',
  post_game_debrief: 'Post-Game Debrief', reset_note: 'Reset Note', training_note: 'Training Note',
};

const statusConfig: Record<ScriptStatus, { label: string; color: string }> = {
  current: { label: 'Current', color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' },
  draft: { label: 'Draft', color: 'bg-slate-700/50 text-slate-400 border-slate-600/50' },
  in_review: { label: 'In Review', color: 'bg-blue-900/50 text-blue-300 border-blue-700/50' },
  archived: { label: 'Archived', color: 'bg-slate-800/50 text-slate-500 border-slate-700/50' },
  needs_update: { label: 'Needs Update', color: 'bg-amber-900/50 text-amber-300 border-amber-700/50' },
};

export default function ScriptLibrary({ state, onNavigateToEditor }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = state.scripts.filter((script) => {
    const matchesSearch = !searchQuery || script.title.toLowerCase().includes(searchQuery.toLowerCase()) || script.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRoom = filterRoom === 'all' || script.roomId === filterRoom;
    const matchesType = filterType === 'all' || script.scriptType === filterType;
    const matchesStatus = filterStatus === 'all' || script.status === filterStatus;
    return matchesSearch && matchesRoom && matchesType && matchesStatus;
  });

  const byRoom: Record<string, Script[]> = {};
  for (const script of filtered) {
    if (!byRoom[script.roomId]) byRoom[script.roomId] = [];
    byRoom[script.roomId].push(script);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Script Library</h1>
          <p className="text-slate-400 text-sm mt-0.5">All scripts across all rooms. Filter by room, type, or status.</p>
        </div>
        <button onClick={() => onNavigateToEditor()} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> New Script</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Search scripts or tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
            <option value="all">All Rooms</option>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(scriptTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(statusConfig).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <FileText className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No scripts match your filters</p>
          <button onClick={() => onNavigateToEditor()} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Create Script</button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byRoom).map(([roomId, scripts]) => {
            const room = state.rooms.find((r) => r.id === roomId);
            return (
              <div key={roomId}>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{room?.name ?? 'Unassigned Room'}</h2>
                <div className="space-y-2">
                  {scripts.map((script) => {
                    const currentVersion = state.scriptVersions.find((v) => v.id === script.currentVersionId);
                    const versionCount = state.scriptVersions.filter((v) => v.scriptId === script.id).length;
                    const cfg = statusConfig[script.status];
                    return (
                      <div key={script.id} className="flex items-center gap-4 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 hover:border-slate-600 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-100 text-sm">{script.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-xs px-2 py-0.5 rounded border border-slate-700/50 bg-slate-700/30 text-slate-400">{scriptTypeLabels[script.scriptType]}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            {currentVersion && <span>v{currentVersion.versionNumber}</span>}
                            <span>{versionCount} version{versionCount !== 1 ? 's' : ''}</span>
                            {script.tags.length > 0 && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{script.tags.slice(0, 3).join(', ')}{script.tags.length > 3 && ` +${script.tags.length - 3}`}</span>}
                            <span>Updated {new Date(script.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button onClick={() => onNavigateToEditor(script.id)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-xs text-slate-300 hover:bg-slate-600/60 transition-colors opacity-0 group-hover:opacity-100">
                          Edit <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="text-xs text-slate-600 text-right">{filtered.length} of {state.scripts.length} script{state.scripts.length !== 1 ? 's' : ''}</div>
    </div>
  );
}
