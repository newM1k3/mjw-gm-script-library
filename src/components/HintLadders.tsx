import { useState } from 'react';
import { Plus, CreditCard as Edit2, Save, X, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { AppState, HintLadder, HintStep, SpoilerLevel } from '../types';

interface Props {
  state: AppState;
  onAddLadder: (ladder: HintLadder) => void;
  onUpdateLadder: (ladder: HintLadder) => void;
}

const spoilerColors: Record<SpoilerLevel, string> = {
  low: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  medium: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  high: 'bg-red-900/40 text-red-300 border-red-700/50',
};

const emptyLadder = (roomId: string): Omit<HintLadder, 'id' | 'createdAt' | 'updatedAt'> => ({
  roomId, puzzleLabel: '', stageLabel: '', triggerCondition: '',
  hints: [{ level: 1, text: '', spoilerLevel: 'low' }, { level: 2, text: '', spoilerLevel: 'medium' }, { level: 3, text: '', spoilerLevel: 'high' }],
  notes: '',
});

export default function HintLadders({ state, onAddLadder, onUpdateLadder }: Props) {
  const [filterRoom, setFilterRoom] = useState(state.rooms[0]?.id ?? 'all');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedLadder, setExpandedLadder] = useState<string | null>(null);
  const [form, setForm] = useState(emptyLadder(state.rooms[0]?.id ?? ''));

  const filteredLadders = state.hintLadders.filter((h) => filterRoom === 'all' || h.roomId === filterRoom);

  function handleAdd() { setAdding(true); setEditing(null); setForm(emptyLadder(filterRoom === 'all' ? (state.rooms[0]?.id ?? '') : filterRoom)); }
  function handleEdit(ladder: HintLadder) { setEditing(ladder.id); setAdding(false); setForm({ roomId: ladder.roomId, puzzleLabel: ladder.puzzleLabel, stageLabel: ladder.stageLabel, triggerCondition: ladder.triggerCondition, hints: ladder.hints.map((h) => ({ ...h })), notes: ladder.notes }); }
  function handleCancel() { setEditing(null); setAdding(false); }

  function handleSaveNew() {
    const now = new Date().toISOString();
    onAddLadder({ id: `hint_${Date.now()}`, ...form, hints: form.hints.filter((h) => h.text.trim()), createdAt: now, updatedAt: now });
    setAdding(false);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const existing = state.hintLadders.find((h) => h.id === editing);
    if (!existing) return;
    onUpdateLadder({ ...existing, ...form, hints: form.hints.filter((h) => h.text.trim()), updatedAt: new Date().toISOString() });
    setEditing(null);
  }

  function updateHint(index: number, field: keyof HintStep, value: string | number) {
    setForm((f) => ({ ...f, hints: f.hints.map((h, i) => i === index ? { ...h, [field]: value } : h) }));
  }

  function addHint() { setForm((f) => ({ ...f, hints: [...f.hints, { level: f.hints.length + 1, text: '', spoilerLevel: 'medium' as SpoilerLevel }] })); }
  function removeHint(index: number) { setForm((f) => ({ ...f, hints: f.hints.filter((_, i) => i !== index).map((h, i) => ({ ...h, level: i + 1 })) })); }

  function renderForm(onSave: () => void) {
    return (
      <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Room</label>
            <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
              {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Puzzle Label</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Clock Symbol Drawer Lock" value={form.puzzleLabel} onChange={(e) => setForm((f) => ({ ...f, puzzleLabel: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Stage Label</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Starting Workshop" value={form.stageLabel} onChange={(e) => setForm((f) => ({ ...f, stageLabel: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Trigger Condition</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Players have found symbols but not used them after 8 min." value={form.triggerCondition} onChange={(e) => setForm((f) => ({ ...f, triggerCondition: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Hint Levels</label>
            <button onClick={addHint} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"><Plus className="w-3 h-3" /> Add Level</button>
          </div>
          {form.hints.map((hint, index) => (
            <div key={index} className="flex items-start gap-3 bg-slate-700/50 rounded-lg p-3">
              <span className="text-xs font-bold text-slate-400 mt-2.5 w-6 flex-shrink-0">L{hint.level}</span>
              <div className="flex-1 space-y-2">
                <textarea rows={2} className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none" placeholder="Hint text..." value={hint.text} onChange={(e) => updateHint(index, 'text', e.target.value)} />
                <select className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" value={hint.spoilerLevel} onChange={(e) => updateHint(index, 'spoilerLevel', e.target.value as SpoilerLevel)}>
                  <option value="low">Low Spoiler</option><option value="medium">Medium Spoiler</option><option value="high">High Spoiler</option>
                </select>
              </div>
              {form.hints.length > 1 && <button onClick={() => removeHint(index)} className="mt-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">GM Notes</label>
          <textarea rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" placeholder="Timing guidance, escalation notes..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-3">
          <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Save className="w-4 h-4" /> Save Ladder</button>
          <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"><X className="w-4 h-4" /> Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Hint Ladders</h1>
          <p className="text-slate-400 text-sm mt-0.5">Progressive, tiered hints by puzzle. Start low-spoiler, escalate only as needed.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
            <option value="all">All Rooms</option>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {!adding && <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Ladder</button>}
        </div>
      </div>

      {adding && renderForm(handleSaveNew)}

      <div className="space-y-3">
        {filteredLadders.map((ladder) => {
          const isEditing = editing === ladder.id;
          const isExpanded = expandedLadder === ladder.id;
          const hasGap = ladder.hints.some((h) => h.spoilerLevel === 'high') && !ladder.hints.some((h) => h.spoilerLevel === 'low' || h.spoilerLevel === 'medium');
          return (
            <div key={ladder.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
              {isEditing ? <div className="p-5">{renderForm(handleSaveEdit)}</div> : (
                <>
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-700/30 transition-colors" onClick={() => setExpandedLadder(isExpanded ? null : ladder.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-100">{ladder.puzzleLabel}</span>
                        {hasGap && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="w-3 h-3" /> no low hints</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{ladder.stageLabel}</span>
                        <span>{ladder.hints.length} hint{ladder.hints.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(ladder); }} className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-700/60 px-5 py-4 space-y-3">
                      <p className="text-xs text-slate-400"><span className="font-medium text-slate-300">Trigger:</span> {ladder.triggerCondition}</p>
                      <div className="space-y-2">
                        {ladder.hints.sort((a, b) => a.level - b.level).map((hint) => (
                          <div key={hint.level} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-sm ${spoilerColors[hint.spoilerLevel]}`}>
                            <span className="text-xs font-bold flex-shrink-0 mt-0.5">L{hint.level}</span>
                            <span className="flex-1 leading-relaxed">{hint.text}</span>
                            <span className="text-xs opacity-70 flex-shrink-0 mt-0.5 capitalize">{hint.spoilerLevel}</span>
                          </div>
                        ))}
                      </div>
                      {ladder.notes && <p className="text-xs text-slate-500 italic">{ladder.notes}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {filteredLadders.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <p className="text-slate-400 font-medium">No hint ladders yet</p>
          <button onClick={handleAdd} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Hint Ladder</button>
        </div>
      )}
    </div>
  );
}
