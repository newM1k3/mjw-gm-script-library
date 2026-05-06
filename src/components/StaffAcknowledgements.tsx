import { useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, User, Plus } from 'lucide-react';
import { AppState, Acknowledgement, StaffMember } from '../types';

interface Props {
  state: AppState;
  onAcknowledge: (ack: Acknowledgement) => void;
  onAddStaff: (staff: StaffMember) => void;
}

export default function StaffAcknowledgements({ state, onAcknowledge, onAddStaff }: Props) {
  const [filterRoom, setFilterRoom] = useState(state.rooms[0]?.id ?? 'all');
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', role: '', notes: '' });

  const currentScripts = state.scripts.filter((s) => {
    if (!s.currentVersionId) return false;
    return filterRoom === 'all' || s.roomId === filterRoom;
  });

  function handleAcknowledge(staffId: string, scriptId: string, versionId: string) {
    const existing = state.acknowledgements.find((a) => a.staffId === staffId && a.scriptId === scriptId && a.versionId === versionId);
    if (existing) return;
    onAcknowledge({ id: `ack_${Date.now()}`, staffId, scriptId, versionId, acknowledgedAt: new Date().toISOString(), notes: '' });
  }

  function getStaffStatus(staffId: string, scriptId: string, currentVersionId: string): 'current' | 'outdated' | 'none' {
    const hasCurrentAck = state.acknowledgements.some((a) => a.staffId === staffId && a.scriptId === scriptId && a.versionId === currentVersionId);
    if (hasCurrentAck) return 'current';
    const hasOlderAck = state.acknowledgements.some((a) => a.staffId === staffId && a.scriptId === scriptId);
    return hasOlderAck ? 'outdated' : 'none';
  }

  function handleAddStaff() {
    if (!staffForm.name.trim()) return;
    onAddStaff({ id: `staff_${Date.now()}`, name: staffForm.name.trim(), role: staffForm.role.trim() || 'Game Master', active: true, notes: staffForm.notes.trim() });
    setStaffForm({ name: '', role: '', notes: '' });
    setAddingStaff(false);
  }

  const activeStaff = state.staffMembers.filter((s) => s.active);
  const totalRequired = activeStaff.length * currentScripts.length;
  const totalAcknowledged = activeStaff.reduce((count, staff) => count + currentScripts.filter((script) => state.acknowledgements.some((a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId)).length, 0);
  const totalOutdated = activeStaff.reduce((count, staff) => count + currentScripts.filter((script) => getStaffStatus(staff.id, script.id, script.currentVersionId!) === 'outdated').length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Staff Acknowledgements</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track which staff have reviewed the current version of each script.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
            <option value="all">All Rooms</option>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => setAddingStaff(!addingStaff)} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"><Plus className="w-4 h-4" /> Staff</button>
        </div>
      </div>

      {totalRequired > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{totalAcknowledged}</div>
            <div className="text-xs text-emerald-500 mt-0.5">Acknowledged</div>
          </div>
          <div className={`${totalOutdated > 0 ? 'bg-amber-900/30 border-amber-700/40' : 'bg-slate-800/40 border-slate-700/40'} border rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${totalOutdated > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{totalOutdated}</div>
            <div className={`text-xs mt-0.5 ${totalOutdated > 0 ? 'text-amber-500' : 'text-slate-600'}`}>Outdated</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-slate-400">{totalRequired - totalAcknowledged - totalOutdated}</div>
            <div className="text-xs text-slate-600 mt-0.5">Not Started</div>
          </div>
        </div>
      )}

      {addingStaff && (
        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Add Staff Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="First name or display name" value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Game Master, Operations Lead..." value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAddStaff} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">Add Staff Member</button>
            <button onClick={() => setAddingStaff(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {activeStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <User className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No staff members yet</p>
          <button onClick={() => setAddingStaff(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Staff</button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeStaff.map((staff) => {
            const statuses = currentScripts.map((script) => ({
              script,
              status: getStaffStatus(staff.id, script.id, script.currentVersionId!),
              ack: state.acknowledgements.find((a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId),
            }));
            const currentCount = statuses.filter((s) => s.status === 'current').length;
            const outdatedCount = statuses.filter((s) => s.status === 'outdated').length;
            const noneCount = statuses.filter((s) => s.status === 'none').length;
            return (
              <div key={staff.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-sm font-bold text-slate-300">{staff.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="font-semibold text-slate-100">{staff.name}</div>
                      <div className="text-xs text-slate-500">{staff.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {outdatedCount > 0 && <span className="flex items-center gap-1 text-amber-400"><AlertTriangle className="w-3 h-3" /> {outdatedCount} outdated</span>}
                    {noneCount > 0 && <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3 h-3" /> {noneCount} pending</span>}
                    {currentCount === currentScripts.length && currentScripts.length > 0 && <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="w-3 h-3" /> all current</span>}
                  </div>
                </div>
                {currentScripts.length === 0 ? (
                  <p className="text-xs text-slate-500">No current scripts to acknowledge for this filter.</p>
                ) : (
                  <div className="space-y-2">
                    {statuses.map(({ script, status, ack }) => {
                      const room = state.rooms.find((r) => r.id === script.roomId);
                      return (
                        <div key={script.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-700/40 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200 truncate">{script.title}</div>
                            <div className="text-xs text-slate-500">{room?.name ?? 'Unknown room'}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {status === 'current' && ack && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3.5 h-3.5" />{new Date(ack.acknowledgedAt).toLocaleDateString()}</span>}
                            {status === 'outdated' && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="w-3 h-3" /> outdated</span>}
                            {(status === 'none' || status === 'outdated') && (
                              <button onClick={() => handleAcknowledge(staff.id, script.id, script.currentVersionId!)} className="px-3 py-1 bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 text-xs rounded-lg hover:bg-emerald-800/50 transition-colors">Acknowledge</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
