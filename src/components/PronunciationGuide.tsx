import { useState } from 'react';
import { Plus, CreditCard as Edit2, Save, X, Volume2, AlertTriangle } from 'lucide-react';
import { AppState, PronunciationTerm } from '../types';

interface Props {
  state: AppState;
  onAddTerm: (term: PronunciationTerm) => void;
  onUpdateTerm: (term: PronunciationTerm) => void;
}

const emptyTerm = (roomId: string): Omit<PronunciationTerm, 'id' | 'createdAt' | 'updatedAt'> => ({
  roomId, term: '', phonetic: '', meaning: '', context: '', deliveryNote: '', audioNoteUrl: '',
});

export default function PronunciationGuide({ state, onAddTerm, onUpdateTerm }: Props) {
  const [filterRoom, setFilterRoom] = useState(state.rooms[0]?.id ?? 'all');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyTerm(state.rooms[0]?.id ?? ''));

  const filteredTerms = state.pronunciationTerms.filter((t) => filterRoom === 'all' || t.roomId === filterRoom);

  function handleAdd() { setAdding(true); setEditing(null); setForm(emptyTerm(filterRoom === 'all' ? (state.rooms[0]?.id ?? '') : filterRoom)); }
  function handleEdit(term: PronunciationTerm) { setEditing(term.id); setAdding(false); setForm({ roomId: term.roomId, term: term.term, phonetic: term.phonetic, meaning: term.meaning, context: term.context, deliveryNote: term.deliveryNote, audioNoteUrl: term.audioNoteUrl }); }
  function handleCancel() { setEditing(null); setAdding(false); }

  function handleSaveNew() {
    const now = new Date().toISOString();
    onAddTerm({ id: `pron_${Date.now()}`, ...form, createdAt: now, updatedAt: now });
    setAdding(false);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const existing = state.pronunciationTerms.find((t) => t.id === editing);
    if (!existing) return;
    onUpdateTerm({ ...existing, ...form, updatedAt: new Date().toISOString() });
    setEditing(null);
  }

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
            <label className="block text-xs font-medium text-slate-400 mb-1">Term *</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Elias Wren" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Phonetic Spelling</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono" placeholder="e.g. EE-lee-us REN" value={form.phonetic} onChange={(e) => setForm((f) => ({ ...f, phonetic: e.target.value }))} />
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
            <label className="block text-xs font-medium text-slate-400 mb-1">Delivery Note</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="How to say it — slowly, with pause, etc." value={form.deliveryNote} onChange={(e) => setForm((f) => ({ ...f, deliveryNote: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-700/30 border border-slate-600/30 rounded-lg p-3">
          <Volume2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          <span>Audio note recording is a future feature. Delivery notes serve as the current GM guide.</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Save className="w-4 h-4" /> Save Term</button>
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
          <p className="text-slate-400 text-sm mt-0.5">Phonetic spellings and delivery notes for room-specific names and terms.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
            <option value="all">All Rooms</option>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {!adding && <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Term</button>}
        </div>
      </div>

      {adding && renderForm(handleSaveNew)}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTerms.map((term) => {
          const isEditing = editing === term.id;
          const room = state.rooms.find((r) => r.id === term.roomId);
          return (
            <div key={term.id}>
              {isEditing ? renderForm(handleSaveEdit) : (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-lg font-semibold text-slate-100">{term.term}</span>
                        {term.phonetic ? (
                          <span className="font-mono text-sm text-blue-300 bg-blue-900/30 border border-blue-700/40 px-2 py-0.5 rounded">{term.phonetic}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="w-3 h-3" /> no phonetic</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{room?.name}</p>
                    </div>
                    <button onClick={() => handleEdit(term)} className="ml-2 p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {term.meaning && <p className="text-sm text-slate-300 mt-2">{term.meaning}</p>}
                  {term.context && <p className="text-xs text-slate-500 mt-1">{term.context}</p>}
                  {term.deliveryNote && (
                    <div className="mt-3 flex items-start gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                      <Volume2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-slate-400 italic">{term.deliveryNote}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredTerms.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <Volume2 className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No terms yet</p>
          <button onClick={handleAdd} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Term</button>
        </div>
      )}
    </div>
  );
}
