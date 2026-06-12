import { useMemo, useState } from 'react';
import { Plus, CreditCard as Edit2, Save, X, Volume2, AlertTriangle, Archive, Search, ExternalLink } from 'lucide-react';
import { AppState, PronunciationTerm } from '../types';
import { useToast } from '../lib/useToast';
import ConfirmModal from './ConfirmModal';

interface Props {
  state: AppState;
  onAddTerm: (term: PronunciationTerm) => void;
  onUpdateTerm: (term: PronunciationTerm) => void;
}

const emptyTerm = (roomId: string): Omit<PronunciationTerm, 'id' | 'createdAt' | 'updatedAt'> => ({
  roomId, term: '', phonetic: '', meaning: '', context: '', deliveryNote: '', audioNoteUrl: '',
});

function isArchived(term: PronunciationTerm) {
  return term.deliveryNote.includes('[ARCHIVED]');
}

function cleanArchiveMarker(value: string) {
  return value.replace(/^\[ARCHIVED\]\s*/i, '').trim();
}

export default function PronunciationGuide({ state, onAddTerm, onUpdateTerm }: Props) {
  const { toast } = useToast();
  const [filterRoom, setFilterRoom] = useState(state.rooms[0]?.id ?? 'all');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyTerm(state.rooms[0]?.id ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingArchiveTerm, setPendingArchiveTerm] = useState<PronunciationTerm | null>(null);

  const filteredTerms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return state.pronunciationTerms.filter((term) => {
      const archiveMatch = showArchived || !isArchived(term);
      const roomMatch = filterRoom === 'all' || term.roomId === filterRoom;
      const queryMatch = !query || [term.term, term.phonetic, term.meaning, term.context, cleanArchiveMarker(term.deliveryNote)].some((field) => field.toLowerCase().includes(query));
      return archiveMatch && roomMatch && queryMatch;
    });
  }, [filterRoom, search, showArchived, state.pronunciationTerms]);

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.roomId) nextErrors.roomId = 'A room is required for every pronunciation term.';
    if (!form.term.trim()) nextErrors.term = 'Term is required so GMs can search and recognize it during live delivery.';
    if (form.term.trim().length > 120) nextErrors.term = 'Term must be 120 characters or fewer.';
    if (form.phonetic.trim() && !/^[A-Za-zÀ-ÿ0-9\s.'’\-/()]+$/.test(form.phonetic.trim())) nextErrors.phonetic = 'Phonetic spelling should use letters, numbers, spaces, hyphens, slashes, apostrophes, or parentheses only.';
    if (form.audioNoteUrl.trim()) {
      try {
        const url = new URL(form.audioNoteUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) nextErrors.audioNoteUrl = 'Audio URL must start with http:// or https://.';
      } catch {
        nextErrors.audioNoteUrl = 'Audio URL must be a valid full URL, such as https://example.com/audio.mp3.';
      }
    }
    return nextErrors;
  }

  function handleAdd() { setAdding(true); setEditing(null); setErrors({}); setForm(emptyTerm(filterRoom === 'all' ? (state.rooms[0]?.id ?? '') : filterRoom)); }
  function handleEdit(term: PronunciationTerm) { setEditing(term.id); setAdding(false); setErrors({}); setForm({ roomId: term.roomId, term: term.term, phonetic: term.phonetic, meaning: term.meaning, context: term.context, deliveryNote: cleanArchiveMarker(term.deliveryNote), audioNoteUrl: term.audioNoteUrl }); }
  function handleCancel() { setEditing(null); setAdding(false); setErrors({}); setSaving(false); }

  function handleSaveNew() {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); toast('Pronunciation term could not be saved. Check the highlighted fields.'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const term = form.term.trim();
    onAddTerm({ id: `pron_${Date.now()}`, ...form, term, phonetic: form.phonetic.trim(), meaning: form.meaning.trim(), context: form.context.trim(), deliveryNote: form.deliveryNote.trim(), audioNoteUrl: form.audioNoteUrl.trim(), createdAt: now, updatedAt: now });
    toast(`Pronunciation term "${term}" saved`);
    setAdding(false); setForm(emptyTerm(filterRoom === 'all' ? (state.rooms[0]?.id ?? '') : filterRoom)); setErrors({}); setSaving(false);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); toast('Pronunciation term could not be saved. Check the highlighted fields.'); return; }
    const existing = state.pronunciationTerms.find((t) => t.id === editing);
    if (!existing) return;
    setSaving(true);
    const archivePrefix = isArchived(existing) ? '[ARCHIVED] ' : '';
    const term = form.term.trim();
    onUpdateTerm({ ...existing, ...form, term, phonetic: form.phonetic.trim(), meaning: form.meaning.trim(), context: form.context.trim(), deliveryNote: `${archivePrefix}${form.deliveryNote.trim()}`.trim(), audioNoteUrl: form.audioNoteUrl.trim(), updatedAt: new Date().toISOString() });
    toast(`Pronunciation term "${term}" updated`);
    setEditing(null); setErrors({}); setSaving(false);
  }

  function requestArchive(term: PronunciationTerm) {
    setPendingArchiveTerm(term);
  }

  function confirmArchive() {
    if (!pendingArchiveTerm) return;
    onUpdateTerm({ ...pendingArchiveTerm, deliveryNote: `[ARCHIVED] ${cleanArchiveMarker(pendingArchiveTerm.deliveryNote)}`.trim(), updatedAt: new Date().toISOString() });
    toast(`Pronunciation term "${pendingArchiveTerm.term}" archived`);
    setPendingArchiveTerm(null);
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
            <label className="block text-xs font-medium text-slate-400 mb-1">Term *</label>
            <input className={`w-full bg-slate-700 border ${errors.term ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="e.g. Elias Wren" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
            {errors.term && <p className="text-xs text-red-400 mt-1">{errors.term}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Phonetic Spelling</label>
            <input className={`w-full bg-slate-700 border ${errors.phonetic ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono`} placeholder="e.g. EE-lee-us REN" value={form.phonetic} onChange={(e) => setForm((f) => ({ ...f, phonetic: e.target.value }))} />
            {errors.phonetic && <p className="text-xs text-red-400 mt-1">{errors.phonetic}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Meaning</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. The missing Victorian clockmaker" value={form.meaning} onChange={(e) => setForm((f) => ({ ...f, meaning: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Context</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Where this term appears in scripts" value={form.context} onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Audio URL</label>
            <input className={`w-full bg-slate-700 border ${errors.audioNoteUrl ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="https://..." value={form.audioNoteUrl} onChange={(e) => setForm((f) => ({ ...f, audioNoteUrl: e.target.value }))} />
            {errors.audioNoteUrl && <p className="text-xs text-red-400 mt-1">{errors.audioNoteUrl}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Delivery Note</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="How to say it — slowly, with pause, etc." value={form.deliveryNote} onChange={(e) => setForm((f) => ({ ...f, deliveryNote: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-700/30 border border-slate-600/30 rounded-lg p-3">
          <Volume2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          <span>Audio URLs are optional. If provided, use a stable HTTPS link to a pronunciation clip accessible to GMs.</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Term'}</button>
          <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"><X className="w-4 h-4" /> Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Pronunciation Guide</h1>
          <p className="text-slate-400 text-sm mt-0.5">Phonetic spellings, delivery notes, and optional audio references for room-specific names and terms.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Search terms…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
            <option value="all">All Rooms</option>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
          {!adding && <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Term</button>}
        </div>
      </div>

      {adding && renderForm(handleSaveNew)}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTerms.map((term) => {
          const isEditing = editing === term.id;
          const room = state.rooms.find((r) => r.id === term.roomId);
          const archived = isArchived(term);
          return (
            <div key={term.id}>
              {isEditing ? renderForm(handleSaveEdit) : (
                <div className={`bg-slate-800/60 border ${archived ? 'border-red-900/40 opacity-70' : 'border-slate-700/60'} rounded-xl p-5 group`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-lg font-semibold text-slate-100">{term.term}</span>
                        {term.phonetic ? (
                          <span className="font-mono text-sm text-blue-300 bg-blue-900/30 border border-blue-700/40 px-2 py-0.5 rounded">{term.phonetic}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="w-3 h-3" /> no phonetic</span>
                        )}
                        {archived && <span className="text-xs text-red-300 border border-red-900/60 rounded px-2 py-0.5">archived</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{room?.name}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(term)} className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      {!archived && <button onClick={() => requestArchive(term)} className="p-1.5 text-slate-500 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400" aria-label={`Archive pronunciation term ${term.term}`}><Archive className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                  {term.meaning && <p className="text-sm text-slate-300 mt-2">{term.meaning}</p>}
                  {term.context && <p className="text-xs text-slate-500 mt-1">{term.context}</p>}
                  {term.audioNoteUrl && <a href={term.audioNoteUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200"><ExternalLink className="w-3 h-3" /> Audio reference</a>}
                  {cleanArchiveMarker(term.deliveryNote) && (
                    <div className="mt-3 flex items-start gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                      <Volume2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-slate-400 italic">{cleanArchiveMarker(term.deliveryNote)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingArchiveTerm && (
        <ConfirmModal
          title={`Archive ${pendingArchiveTerm.term}?`}
          message="This pronunciation term will be hidden from GM Mode but retained in operational records, exports, and audit history."
          confirmLabel="Archive term"
          confirmDanger
          onConfirm={confirmArchive}
          onCancel={() => setPendingArchiveTerm(null)}
        />
      )}

      {filteredTerms.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <Volume2 className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No pronunciation terms match the current filters</p>
          <button onClick={handleAdd} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Term</button>
        </div>
      )}
    </div>
  );
}
