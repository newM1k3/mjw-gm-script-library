import { useState } from 'react';
import { Plus, CreditCard as Edit2, Save, X, Clock, Star, Info, Archive } from 'lucide-react';
import { Room, RoomStatus, RoomDifficulty, AppState } from '../types';
import { useToast } from '../lib/useToast';
import ConfirmModal from './ConfirmModal';

interface Props {
  state: AppState;
  onAddRoom: (room: Room) => void;
  onUpdateRoom: (room: Room) => void;
}

const emptyRoom = (): Omit<Room, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '', theme: '', durationMinutes: 60, difficulty: 'medium', status: 'active', notes: '',
});

const statusOptions: { value: RoomStatus; label: string }[] = [
  { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' }, { value: 'retired', label: 'Retired' },
];
const difficultyOptions: { value: RoomDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }, { value: 'expert', label: 'Expert' },
];
const statusColors: Record<RoomStatus, string> = {
  active: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  inactive: 'bg-slate-700/50 text-slate-400 border-slate-600/50',
  maintenance: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  retired: 'bg-red-900/50 text-red-400 border-red-800/50',
};

const MIN_DURATION = 15;
const MAX_DURATION = 180;

export default function RoomSetup({ state, onAddRoom, onUpdateRoom }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyRoom());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingRetireRoom, setPendingRetireRoom] = useState<Room | null>(null);

  function normalizedName(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function validate(currentRoomId?: string) {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Room name is required.';
    if (!form.theme.trim()) e.theme = 'Theme is required.';
    if (form.durationMinutes < MIN_DURATION || form.durationMinutes > MAX_DURATION) e.durationMinutes = `Duration must be ${MIN_DURATION}–${MAX_DURATION} minutes for operational scheduling.`;
    if (normalizedName(form.name) && state.rooms.some((room) => room.id !== currentRoomId && normalizedName(room.name) === normalizedName(form.name))) {
      e.name = 'A room with this name already exists. Use a unique operational room name.';
    }
    if (form.status === 'active' && (!form.theme.trim() || form.durationMinutes < MIN_DURATION)) {
      e.status = 'Active rooms require a theme and a valid operating duration.';
    }
    return e;
  }

  function handleAdd() { setAdding(true); setForm(emptyRoom()); setErrors({}); setEditing(null); }

  function handleEdit(room: Room) {
    setEditing(room.id); setAdding(false); setErrors({});
    setForm({ name: room.name, theme: room.theme, durationMinutes: room.durationMinutes, difficulty: room.difficulty, status: room.status, notes: room.notes });
  }

  function handleCancel() { setEditing(null); setAdding(false); setErrors({}); setSaving(false); }

  function handleSaveNew() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); toast('Room could not be saved. Check the highlighted fields.'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const roomName = form.name.trim().replace(/\s+/g, ' ');
    onAddRoom({ id: `room_${Date.now()}`, ...form, name: roomName, theme: form.theme.trim(), notes: form.notes.trim(), createdAt: now, updatedAt: now });
    toast(`Room "${roomName}" created and saved`);
    setAdding(false); setForm(emptyRoom()); setErrors({}); setSaving(false);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const e = validate(editing);
    if (Object.keys(e).length > 0) { setErrors(e); toast('Room could not be saved. Check the highlighted fields.'); return; }
    const existing = state.rooms.find((r) => r.id === editing);
    if (!existing) return;
    setSaving(true);
    const roomName = form.name.trim().replace(/\s+/g, ' ');
    onUpdateRoom({ ...existing, ...form, name: roomName, theme: form.theme.trim(), notes: form.notes.trim(), updatedAt: new Date().toISOString() });
    toast(`Room "${roomName}" updated`);
    setEditing(null); setErrors({}); setSaving(false);
  }

  function requestRetire(room: Room) {
    setPendingRetireRoom(room);
  }

  function confirmRetire() {
    if (!pendingRetireRoom) return;
    onUpdateRoom({ ...pendingRetireRoom, status: 'retired', updatedAt: new Date().toISOString() });
    toast(`Room "${pendingRetireRoom.name}" retired`);
    setPendingRetireRoom(null);
  }

  function renderForm(onSave: () => void) {
    return (
      <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Room Name *</label>
            <input className={`w-full bg-slate-700 border ${errors.name ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="e.g. The Clockmaker's Last Hour" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Theme *</label>
            <input className={`w-full bg-slate-700 border ${errors.theme ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="e.g. Victorian clockmaker mystery" value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))} />
            {errors.theme && <p className="text-xs text-red-400 mt-1">{errors.theme}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Duration (minutes) *</label>
            <input type="number" min={MIN_DURATION} max={MAX_DURATION} className={`w-full bg-slate-700 border ${errors.durationMinutes ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500`} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || MIN_DURATION }))} />
            {errors.durationMinutes && <p className="text-xs text-red-400 mt-1">{errors.durationMinutes}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
            <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as RoomDifficulty }))}>
              {difficultyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <select className={`w-full bg-slate-700 border ${errors.status ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500`} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.status && <p className="text-xs text-red-400 mt-1">{errors.status}</p>}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Operations Notes</label>
          <textarea rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" placeholder="Player count range, special equipment notes, reset considerations..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-3 pt-1 flex-wrap">
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Room'}</button>
          <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"><X className="w-4 h-4" /> Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Room Setup</h1>
          <p className="text-slate-400 text-sm mt-0.5">Create and manage operational rooms. Retired rooms remain available for exports, audits, and historical records.</p>
        </div>
        {!adding && <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Room</button>}
      </div>

      {adding && renderForm(handleSaveNew)}

      <div className="space-y-4">
        {state.rooms.map((room) => {
          const isEditing = editing === room.id;
          const scriptCount = state.scripts.filter((s) => s.roomId === room.id).length;
          const hintCount = state.hintLadders.filter((h) => h.roomId === room.id && !h.notes.includes('[ARCHIVED]')).length;
          return (
            <div key={room.id}>
              {isEditing ? renderForm(handleSaveEdit) : (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-100">{room.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${statusColors[room.status]}`}>{room.status}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{room.theme}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(room)} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors" title="Edit room"><Edit2 className="w-4 h-4" /></button>
                      {room.status !== 'retired' && <button onClick={() => requestRetire(room)} className="p-2 text-slate-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400" title="Retire room" aria-label={`Retire ${room.name}`}><Archive className="w-4 h-4" /></button>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {room.durationMinutes} minutes</span>
                    <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> {room.difficulty}</span>
                    <span className="flex items-center gap-1.5">{scriptCount} script{scriptCount !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1.5">{hintCount} active hint ladder{hintCount !== 1 ? 's' : ''}</span>
                  </div>
                  {room.notes && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-slate-400 bg-slate-700/40 rounded-lg p-3">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-500" /><span>{room.notes}</span>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-slate-600">Created {new Date(room.createdAt).toLocaleDateString()} · Updated {new Date(room.updatedAt).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingRetireRoom && (
        <ConfirmModal
          title={`Retire ${pendingRetireRoom.name}?`}
          message={`Existing scripts, exports, and audit history will remain available, but the room will be marked retired for operations. ${state.scripts.filter((script) => script.roomId === pendingRetireRoom.id).length} linked script(s) remain attached.`}
          confirmLabel="Retire room"
          confirmDanger
          onConfirm={confirmRetire}
          onCancel={() => setPendingRetireRoom(null)}
        />
      )}

      {state.rooms.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <Clock className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-300 font-medium">No rooms yet</p>
          <button onClick={handleAdd} className="mt-5 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Room</button>
        </div>
      )}
    </div>
  );
}
