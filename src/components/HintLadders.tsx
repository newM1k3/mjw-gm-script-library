import { useMemo, useState } from 'react';
import { Plus, CreditCard as Edit2, Save, X, Trash2, ChevronDown, ChevronUp, AlertTriangle, Archive, ArrowDown, ArrowUp, Eye } from 'lucide-react';
import { AppState, HintLadder, HintStep, SpoilerLevel } from '../types';
import { useToast } from '../lib/useToast';
import ConfirmModal from './ConfirmModal';

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

function isArchived(ladder: HintLadder) {
  return ladder.notes.includes('[ARCHIVED]');
}

function cleanArchiveMarker(value: string) {
  return value.replace(/^\[ARCHIVED\]\s*/i, '').trim();
}

export default function HintLadders({ state, onAddLadder, onUpdateLadder }: Props) {
  const { toast } = useToast();
  const [filterRoom, setFilterRoom] = useState(state.rooms[0]?.id ?? 'all');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedLadder, setExpandedLadder] = useState<string | null>(null);
  const [form, setForm] = useState(emptyLadder(state.rooms[0]?.id ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingArchiveLadder, setPendingArchiveLadder] = useState<HintLadder | null>(null);

  const filteredLadders = useMemo(
    () => state.hintLadders.filter((h) => (filterRoom === 'all' || h.roomId === filterRoom) && (showArchived || !isArchived(h))),
    [filterRoom, showArchived, state.hintLadders],
  );

  const duplicatePuzzleWarning = useMemo(() => {
    const normalized = form.puzzleLabel.trim().toLowerCase();
    if (!normalized) return '';
    const duplicate = state.hintLadders.find((ladder) => ladder.id !== editing && !isArchived(ladder) && ladder.roomId === form.roomId && ladder.puzzleLabel.trim().toLowerCase() === normalized);
    return duplicate ? `Another active ladder already exists for "${duplicate.puzzleLabel}" in this room. Confirm this is intentional before saving.` : '';
  }, [editing, form.puzzleLabel, form.roomId, state.hintLadders]);

  function normalizeHints(hints: HintStep[]) {
    return hints
      .filter((h) => h.text.trim())
      .map((h, index) => ({ level: index + 1, text: h.text.trim(), spoilerLevel: h.spoilerLevel }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const normalizedHints = normalizeHints(form.hints);
    if (!form.roomId) nextErrors.roomId = 'A room is required for every hint ladder.';
    if (!form.puzzleLabel.trim()) nextErrors.puzzleLabel = 'Puzzle label is required so GMs can find the correct ladder quickly.';
    if (!form.triggerCondition.trim()) nextErrors.triggerCondition = 'Trigger condition is required; define when the GM should offer the first hint.';
    if (normalizedHints.length === 0) nextErrors.hints = 'At least one hint level with text is required.';
    if (normalizedHints.some((hint) => !['low', 'medium', 'high'].includes(hint.spoilerLevel))) nextErrors.hints = 'Each hint must have a valid spoiler level: low, medium, or high.';
    if (normalizedHints.length > 1) {
      const order = { low: 1, medium: 2, high: 3 } as Record<SpoilerLevel, number>;
      const hasReverseEscalation = normalizedHints.some((hint, index) => index > 0 && order[hint.spoilerLevel] < order[normalizedHints[index - 1].spoilerLevel]);
      if (hasReverseEscalation) nextErrors.hints = 'Spoiler levels must escalate or stay the same as levels increase.';
    }
    return nextErrors;
  }

  function handleAdd() { setAdding(true); setEditing(null); setErrors({}); setForm(emptyLadder(filterRoom === 'all' ? (state.rooms[0]?.id ?? '') : filterRoom)); }
  function handleEdit(ladder: HintLadder) { setEditing(ladder.id); setAdding(false); setErrors({}); setForm({ roomId: ladder.roomId, puzzleLabel: ladder.puzzleLabel, stageLabel: ladder.stageLabel, triggerCondition: ladder.triggerCondition, hints: ladder.hints.map((h) => ({ ...h })), notes: cleanArchiveMarker(ladder.notes) }); }
  function handleCancel() { setEditing(null); setAdding(false); setErrors({}); setSaving(false); }

  function handleSaveNew() {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); toast('Hint ladder could not be saved. Check the highlighted validation messages.'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    onAddLadder({ id: `hint_${Date.now()}`, ...form, puzzleLabel: form.puzzleLabel.trim(), stageLabel: form.stageLabel.trim(), triggerCondition: form.triggerCondition.trim(), notes: form.notes.trim(), hints: normalizeHints(form.hints), createdAt: now, updatedAt: now });
    toast(`Hint ladder "${form.puzzleLabel.trim()}" saved`);
    setAdding(false); setForm(emptyLadder(filterRoom === 'all' ? (state.rooms[0]?.id ?? '') : filterRoom)); setErrors({}); setSaving(false);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); toast('Hint ladder could not be saved. Check the highlighted validation messages.'); return; }
    const existing = state.hintLadders.find((h) => h.id === editing);
    if (!existing) return;
    setSaving(true);
    const archivePrefix = isArchived(existing) ? '[ARCHIVED] ' : '';
    onUpdateLadder({ ...existing, ...form, puzzleLabel: form.puzzleLabel.trim(), stageLabel: form.stageLabel.trim(), triggerCondition: form.triggerCondition.trim(), notes: `${archivePrefix}${form.notes.trim()}`.trim(), hints: normalizeHints(form.hints), updatedAt: new Date().toISOString() });
    toast(`Hint ladder "${form.puzzleLabel.trim()}" updated`);
    setEditing(null); setErrors({}); setSaving(false);
  }

  function requestArchive(ladder: HintLadder) {
    setPendingArchiveLadder(ladder);
  }

  function confirmArchive() {
    if (!pendingArchiveLadder) return;
    onUpdateLadder({ ...pendingArchiveLadder, notes: `[ARCHIVED] ${cleanArchiveMarker(pendingArchiveLadder.notes)}`.trim(), updatedAt: new Date().toISOString() });
    toast(`Hint ladder "${pendingArchiveLadder.puzzleLabel}" archived`);
    setPendingArchiveLadder(null);
  }

  function updateHint(index: number, field: keyof HintStep, value: string | number) {
    setForm((f) => ({ ...f, hints: f.hints.map((h, i) => i === index ? { ...h, [field]: value } : h) }));
  }

  function addHint() { setForm((f) => ({ ...f, hints: [...f.hints, { level: f.hints.length + 1, text: '', spoilerLevel: 'medium' as SpoilerLevel }] })); }
  function removeHint(index: number) { setForm((f) => ({ ...f, hints: f.hints.filter((_, i) => i !== index).map((h, i) => ({ ...h, level: i + 1 })) })); }
  function moveHint(index: number, direction: -1 | 1) {
    setForm((f) => {
      const next = [...f.hints];
      const target = index + direction;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...f, hints: next.map((h, i) => ({ ...h, level: i + 1 })) };
    });
  }

  function renderPreview() {
    const previewHints = normalizeHints(form.hints);
    return (
      <div className="bg-slate-950/40 border border-slate-700 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Eye className="w-3.5 h-3.5" /> GM Mode Preview</div>
        <p className="text-xs text-slate-500"><span className="text-slate-300">Trigger:</span> {form.triggerCondition.trim() || 'Define the trigger condition before live use.'}</p>
        {previewHints.length === 0 ? <p className="text-xs text-amber-400">Add at least one hint to preview escalation.</p> : previewHints.map((hint) => (
          <div key={hint.level} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${spoilerColors[hint.spoilerLevel]}`}>
            <span className="font-bold text-xs mt-0.5">L{hint.level}</span><span className="flex-1">{hint.text}</span><span className="text-xs opacity-70 capitalize">{hint.spoilerLevel}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderForm(onSave: () => void) {
    return (
      <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Room</label>
            <select className={`w-full bg-slate-700 border ${errors.roomId ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500`} value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
              {state.rooms.filter((r) => r.status !== 'retired').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {errors.roomId && <p className="text-xs text-red-400 mt-1">{errors.roomId}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Puzzle Label *</label>
            <input className={`w-full bg-slate-700 border ${errors.puzzleLabel ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="e.g. Clock Symbol Drawer Lock" value={form.puzzleLabel} onChange={(e) => setForm((f) => ({ ...f, puzzleLabel: e.target.value }))} />
            {errors.puzzleLabel && <p className="text-xs text-red-400 mt-1">{errors.puzzleLabel}</p>}
            {duplicatePuzzleWarning && <p className="text-xs text-amber-400 mt-1">{duplicatePuzzleWarning}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Stage Label</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Starting Workshop" value={form.stageLabel} onChange={(e) => setForm((f) => ({ ...f, stageLabel: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Trigger Condition *</label>
            <input className={`w-full bg-slate-700 border ${errors.triggerCondition ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="Players have found symbols but not used them after 8 min." value={form.triggerCondition} onChange={(e) => setForm((f) => ({ ...f, triggerCondition: e.target.value }))} />
            {errors.triggerCondition && <p className="text-xs text-red-400 mt-1">{errors.triggerCondition}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Hint Levels</label>
            <button onClick={addHint} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"><Plus className="w-3 h-3" /> Add Level</button>
          </div>
          {errors.hints && <p className="text-xs text-red-400">{errors.hints}</p>}
          {form.hints.map((hint, index) => (
            <div key={index} className="flex items-start gap-3 bg-slate-700/50 rounded-lg p-3">
              <span className="text-xs font-bold text-slate-400 mt-2.5 w-6 flex-shrink-0">L{index + 1}</span>
              <div className="flex-1 space-y-2">
                <textarea rows={2} className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none" placeholder="Hint text..." value={hint.text} onChange={(e) => updateHint(index, 'text', e.target.value)} />
                <select className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" value={hint.spoilerLevel} onChange={(e) => updateHint(index, 'spoilerLevel', e.target.value as SpoilerLevel)}>
                  <option value="low">Low Spoiler</option><option value="medium">Medium Spoiler</option><option value="high">High Spoiler</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <button onClick={() => moveHint(index, -1)} disabled={index === 0} className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveHint(index, 1)} disabled={index === form.hints.length - 1} className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                {form.hints.length > 1 && <button onClick={() => removeHint(index)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">GM Notes</label>
          <textarea rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" placeholder="Timing guidance, escalation notes..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        {renderPreview()}
        <div className="flex gap-3 flex-wrap">
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Ladder'}</button>
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
          <p className="text-slate-400 text-sm mt-0.5">Progressive, tiered hints by puzzle. Archived ladders remain in records but stay out of GM Mode.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
            <option value="all">All Rooms</option>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
          {!adding && <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Ladder</button>}
        </div>
      </div>

      {adding && renderForm(handleSaveNew)}

      <div className="space-y-3">
        {filteredLadders.map((ladder) => {
          const isEditing = editing === ladder.id;
          const isExpanded = expandedLadder === ladder.id;
          const hasGap = ladder.hints.some((h) => h.spoilerLevel === 'high') && !ladder.hints.some((h) => h.spoilerLevel === 'low' || h.spoilerLevel === 'medium');
          const archived = isArchived(ladder);
          return (
            <div key={ladder.id} className={`bg-slate-800/60 border ${archived ? 'border-red-900/40 opacity-70' : 'border-slate-700/60'} rounded-xl overflow-hidden`}>
              {isEditing ? <div className="p-5">{renderForm(handleSaveEdit)}</div> : (
                <>
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-700/30 transition-colors" onClick={() => setExpandedLadder(isExpanded ? null : ladder.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-100">{ladder.puzzleLabel}</span>
                        {archived && <span className="text-xs text-red-300 border border-red-900/60 rounded px-2 py-0.5">archived</span>}
                        {hasGap && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="w-3 h-3" /> no low hints</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{ladder.stageLabel || 'No stage label'}</span>
                        <span>{ladder.hints.length} hint{ladder.hints.length !== 1 ? 's' : ''}</span>
                        <span>{state.rooms.find((r) => r.id === ladder.roomId)?.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(ladder); }} className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      {!archived && <button onClick={(e) => { e.stopPropagation(); requestArchive(ladder); }} className="p-1.5 text-slate-500 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400" aria-label={`Archive hint ladder ${ladder.puzzleLabel}`}><Archive className="w-3.5 h-3.5" /></button>}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-700/60 px-5 py-4 space-y-3">
                      <p className="text-xs text-slate-400"><span className="font-medium text-slate-300">Trigger:</span> {ladder.triggerCondition}</p>
                      <div className="space-y-2">
                        {[...ladder.hints].sort((a, b) => a.level - b.level).map((hint) => (
                          <div key={hint.level} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-sm ${spoilerColors[hint.spoilerLevel]}`}>
                            <span className="text-xs font-bold flex-shrink-0 mt-0.5">L{hint.level}</span>
                            <span className="flex-1 leading-relaxed">{hint.text}</span>
                            <span className="text-xs opacity-70 flex-shrink-0 mt-0.5 capitalize">{hint.spoilerLevel}</span>
                          </div>
                        ))}
                      </div>
                      {cleanArchiveMarker(ladder.notes) && <p className="text-xs text-slate-500 italic">{cleanArchiveMarker(ladder.notes)}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {pendingArchiveLadder && (
        <ConfirmModal
          title={`Archive ${pendingArchiveLadder.puzzleLabel}?`}
          message="This hint ladder will be hidden from GM Mode but retained for exports, readiness audits, and operational history."
          confirmLabel="Archive ladder"
          confirmDanger
          onConfirm={confirmArchive}
          onCancel={() => setPendingArchiveLadder(null)}
        />
      )}

      {filteredLadders.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <p className="text-slate-400 font-medium">No hint ladders match the current filters</p>
          <button onClick={handleAdd} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Hint Ladder</button>
        </div>
      )}
    </div>
  );
}
