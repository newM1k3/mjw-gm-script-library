import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Download, FileJson, FileText, Plus, ShieldAlert, User, XCircle } from 'lucide-react';
import { Acknowledgement, AcknowledgementReportFilters, AcknowledgementStatus, AppState, AuditEvent, ScriptType, StaffMember, StaffPermissionLevel } from '../types';
import { AuthUser, canAcknowledgeForStaff, canManageData } from '../lib/auth';
import {
  acknowledgementStatusLabels,
  buildAcknowledgementReportRows,
  buildAcknowledgementTextSnapshot,
  formatApprovalDate,
  getCurrentVersion,
} from '../lib/acknowledgements';
import { downloadFile, exportAcknowledgementReportJSON, exportAcknowledgementReportMarkdown } from '../services/exporters';
import { useToast } from '../lib/useToast';

interface Props {
  state: AppState;
  currentUser: AuthUser | null;
  onAcknowledge: (ack: Acknowledgement, auditEvent: AuditEvent) => Promise<void>;
  onAddStaff: (staff: StaffMember) => void;
}

const statusStyles: Record<AcknowledgementStatus, string> = {
  current: 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300',
  outdated: 'border-amber-700/50 bg-amber-950/40 text-amber-300',
  not_acknowledged: 'border-slate-700 bg-slate-800/70 text-slate-300',
  revoked: 'border-red-800/60 bg-red-950/40 text-red-300',
  superseded: 'border-orange-700/50 bg-orange-950/40 text-orange-300',
};

const statusIcons: Record<AcknowledgementStatus, React.ComponentType<{ className?: string }>> = {
  current: CheckCircle,
  outdated: AlertTriangle,
  not_acknowledged: Clock,
  revoked: XCircle,
  superseded: ShieldAlert,
};

const scriptTypeLabels: Record<ScriptType, string> = {
  pre_game_brief: 'Pre-Game Brief',
  safety_brief: 'Safety Brief',
  story_intro: 'Story Intro',
  character_intro: 'Character Intro',
  hint_ladder: 'Hint Ladder Script',
  mid_game_intervention: 'Mid-Game Intervention',
  post_game_debrief: 'Post-Game Debrief',
  reset_note: 'Reset Note',
  training_note: 'Training Note',
};

export default function StaffAcknowledgements({ state, currentUser, onAcknowledge, onAddStaff }: Props) {
  const { toast } = useToast();
  const canManageStaff = canManageData(currentUser);
  const [filters, setFilters] = useState<AcknowledgementReportFilters>({ roomId: 'all', staffId: 'all', role: 'all', status: 'all', scriptType: 'all' });
  const [addingStaff, setAddingStaff] = useState(false);
  const [isSubmittingAck, setIsSubmittingAck] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', authUserId: '', role: '', permissionLevel: 'gm' as StaffPermissionLevel, notes: '' });

  const visibleFilters = useMemo(
    () => (canManageStaff ? filters : { ...filters, staffId: currentUser?.staffMemberId ?? '__unlinked__' }),
    [canManageStaff, currentUser?.staffMemberId, filters]
  );
  const reportRows = useMemo(() => buildAcknowledgementReportRows(state, visibleFilters), [state, visibleFilters]);
  const allRows = useMemo(() => buildAcknowledgementReportRows(state, canManageStaff ? filters : visibleFilters), [state, filters, visibleFilters, canManageStaff]);
  const activeStaff = state.staffMembers.filter((staff) => staff.active);
  const roles = Array.from(new Set(activeStaff.map((staff) => staff.role))).sort();
  const currentScriptCount = state.scripts.filter((script) => script.currentVersionId).length;
  const readyCount = reportRows.filter((row) => row.status === 'current').length;
  const notReadyCount = reportRows.length - readyCount;
  const notReadyStaff = Array.from(new Set(reportRows.filter((row) => row.status !== 'current').map((row) => `${row.staffName}::${row.roomName}`)));

  function updateFilter<K extends keyof AcknowledgementReportFilters>(key: K, value: AcknowledgementReportFilters[K]) {
    setFilters((existing) => ({ ...existing, [key]: value }));
  }

  async function handleAcknowledge(staffId: string, scriptId: string) {
    const script = state.scripts.find((candidate) => candidate.id === scriptId);
    if (!script) return;
    const version = getCurrentVersion(state, script);
    if (!version) {
      toast('This script does not have a current approved version to acknowledge.');
      return;
    }
    if (!canAcknowledgeForStaff(currentUser, staffId)) {
      toast('You can only acknowledge scripts for your linked staff profile unless you are a Manager or Owner.');
      return;
    }

    const existingCurrent = state.acknowledgements.find((ack) => ack.staffId === staffId && ack.scriptId === script.id && ack.versionId === version.id && !ack.revokedAt && !ack.supersededByVersionId);
    if (existingCurrent) {
      toast('This current script version is already acknowledged.');
      return;
    }

    const staff = state.staffMembers.find((candidate) => candidate.id === staffId);
    const room = state.rooms.find((candidate) => candidate.id === script.roomId);
    const now = new Date().toISOString();
    const acknowledgementTextSnapshot = buildAcknowledgementTextSnapshot(script, version);
    const ack: Acknowledgement = {
      id: `ack_${Date.now()}`,
      staffId,
      scriptId: script.id,
      versionId: version.id,
      acknowledgedAt: now,
      acknowledgementTextSnapshot,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      source: canManageStaff && currentUser?.staffMemberId !== staffId ? 'manager_review' : 'staff_training',
      notes: `Acknowledged ${script.title} v${version.versionNumber}.`,
    };
    const auditEvent: AuditEvent = {
      id: `audit_ack_${Date.now()}`,
      action: 'acknowledge',
      entityType: 'acknowledgement',
      entityId: ack.id,
      roomId: script.roomId,
      scriptId: script.id,
      versionId: version.id,
      staffId,
      actorStaffId: currentUser?.staffMemberId ?? null,
      actorAuthUserId: currentUser?.authUserId ?? null,
      summary: `${staff?.name ?? 'Staff member'} acknowledged ${script.title} version ${version.versionNumber}${room ? ` for ${room.name}` : ''}.`,
      metadata: {
        scriptTitle: script.title,
        versionNumber: version.versionNumber,
        approvedAt: version.approvedAt,
        requiredBlocks: version.requiredBlocks,
        acknowledgementTextSnapshot,
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      createdAt: now,
    };

    setIsSubmittingAck(`${staffId}:${scriptId}`);
    try {
      await onAcknowledge(ack, auditEvent);
      toast(`${staff?.name ?? 'Staff member'} acknowledged "${script.title}" v${version.versionNumber}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to persist acknowledgement.');
    } finally {
      setIsSubmittingAck(null);
    }
  }

  function handleAddStaff() {
    if (!canManageStaff) {
      toast('Manager or Owner permission is required to add staff members.');
      return;
    }
    if (!staffForm.name.trim()) return;
    const name = staffForm.name.trim();
    onAddStaff({
      id: `staff_${Date.now()}`,
      name,
      email: staffForm.email.trim() || undefined,
      authUserId: staffForm.authUserId.trim() || null,
      role: staffForm.role.trim() || 'Game Master',
      permissionLevel: staffForm.permissionLevel,
      active: true,
      invitedAt: new Date().toISOString(),
      lastLoginAt: null,
      notes: staffForm.notes.trim(),
    });
    setStaffForm({ name: '', email: '', authUserId: '', role: '', permissionLevel: 'gm', notes: '' });
    setAddingStaff(false);
    toast(`${name} added to staff`);
  }

  function handleExport(format: 'markdown' | 'json') {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === 'markdown') {
      downloadFile(exportAcknowledgementReportMarkdown(state, visibleFilters), `acknowledgement-report-${timestamp}.md`, 'text/markdown');
      return;
    }
    downloadFile(exportAcknowledgementReportJSON(state, visibleFilters), `acknowledgement-report-${timestamp}.json`, 'application/json');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Staff Acknowledgements</h1>
          <p className="text-slate-400 text-sm mt-0.5">Authenticated compliance records for current operating script readiness.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => handleExport('markdown')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
            <FileText className="w-4 h-4" /> Markdown
          </button>
          <button onClick={() => handleExport('json')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
            <FileJson className="w-4 h-4" /> JSON
          </button>
          {canManageStaff && <button onClick={() => setAddingStaff(!addingStaff)} aria-label="Add staff member" className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> Staff
          </button>}
        </div>
      </div>

      {!canManageStaff && !currentUser?.staffMemberId && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Your login is authenticated but not linked to an active staff profile. Ask a Manager or Owner to set your staff email or PocketBase auth user ID before acknowledging scripts.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">{reportRows.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Required staff-script acknowledgements</div>
        </div>
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{readyCount}</div>
          <div className="text-xs text-emerald-500 mt-0.5">Current</div>
        </div>
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400">{notReadyCount}</div>
          <div className="text-xs text-amber-500 mt-0.5">Not ready</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">{notReadyStaff.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Staff-room readiness blockers</div>
        </div>
      </div>

      {canManageStaff && (
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3"><Download className="w-4 h-4" /> Manager/Admin Readiness Filters</div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" value={filters.roomId ?? 'all'} onChange={(e) => updateFilter('roomId', e.target.value)}>
              <option value="all">All Rooms</option>
              {state.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" value={filters.staffId ?? 'all'} onChange={(e) => updateFilter('staffId', e.target.value)}>
              <option value="all">All Staff</option>
              {activeStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" value={filters.role ?? 'all'} onChange={(e) => updateFilter('role', e.target.value)}>
              <option value="all">All Roles</option>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" value={filters.status ?? 'all'} onChange={(e) => updateFilter('status', e.target.value as AcknowledgementStatus | 'all')}>
              <option value="all">All Statuses</option>
              {Object.entries(acknowledgementStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" value={filters.scriptType ?? 'all'} onChange={(e) => updateFilter('scriptType', e.target.value as ScriptType | 'all')}>
              <option value="all">All Script Types</option>
              {Object.entries(scriptTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      )}

      {addingStaff && (
        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Add Staff Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="Name *" value={staffForm.name} onChange={(e) => setStaffForm((form) => ({ ...form, name: e.target.value }))} />
            <input className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="Role" value={staffForm.role} onChange={(e) => setStaffForm((form) => ({ ...form, role: e.target.value }))} />
            <input className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="Email" value={staffForm.email} onChange={(e) => setStaffForm((form) => ({ ...form, email: e.target.value }))} />
            <input className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="PocketBase auth user ID" value={staffForm.authUserId} onChange={(e) => setStaffForm((form) => ({ ...form, authUserId: e.target.value }))} />
            <select className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" value={staffForm.permissionLevel} onChange={(e) => setStaffForm((form) => ({ ...form, permissionLevel: e.target.value as StaffPermissionLevel }))}>
              <option value="owner">Owner/Admin</option>
              <option value="manager">Manager</option>
              <option value="lead_gm">Lead GM</option>
              <option value="gm">GM/Staff</option>
              <option value="trainee">Trainee</option>
              <option value="viewer">Viewer</option>
            </select>
            <input className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100" placeholder="Notes" value={staffForm.notes} onChange={(e) => setStaffForm((form) => ({ ...form, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button onClick={handleAddStaff} disabled={!staffForm.name.trim()} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">Add Staff Member</button>
            <button onClick={() => setAddingStaff(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {currentScriptCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <Clock className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No current script versions require acknowledgement yet.</p>
        </div>
      ) : reportRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <User className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No acknowledgement rows match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportRows.map((row) => {
            const script = state.scripts.find((candidate) => candidate.id === row.scriptId);
            const version = script ? getCurrentVersion(state, script) : null;
            const canAct = canAcknowledgeForStaff(currentUser, row.staffId) && row.status !== 'current' && !!script && !!version;
            const Icon = statusIcons[row.status];
            const snapshot = script && version ? buildAcknowledgementTextSnapshot(script, version) : row.acknowledgementTextSnapshot;
            return (
              <div key={`${row.staffId}:${row.scriptId}`} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 mb-1">{row.roomName} · {scriptTypeLabels[row.scriptType]}</div>
                    <h3 className="text-base font-semibold text-slate-100">{row.scriptTitle}</h3>
                    <p className="text-sm text-slate-400 mt-1">{row.staffName} · {row.staffRole}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusStyles[row.status]}`}>
                    <Icon className="w-3.5 h-3.5" /> {acknowledgementStatusLabels[row.status]}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
                    <div className="text-xs text-slate-500">Current version</div>
                    <div className="text-slate-200 font-medium">v{row.currentVersionNumber}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
                    <div className="text-xs text-slate-500">Approval date</div>
                    <div className="text-slate-200 font-medium">{formatApprovalDate(row.approvalDate)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
                    <div className="text-xs text-slate-500">Acknowledged at</div>
                    <div className="text-slate-200 font-medium">{row.acknowledgedAt ? new Date(row.acknowledgedAt).toLocaleString() : '—'}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2">
                  <div className="text-xs text-slate-500 mb-1">Required blocks being acknowledged</div>
                  <div className="flex flex-wrap gap-2">
                    {row.requiredBlocks.length > 0 ? row.requiredBlocks.map((block) => <span key={block} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">{block}</span>) : <span className="text-xs text-slate-500">No required blocks listed.</span>}
                  </div>
                </div>

                {snapshot && (
                  <blockquote className="mt-3 border-l-2 border-slate-600 pl-3 text-sm text-slate-300">
                    {snapshot}
                  </blockquote>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-slate-500">Production records use PocketBase-created timestamps when persisted through the production adapter.</p>
                  <button
                    onClick={() => void handleAcknowledge(row.staffId, row.scriptId)}
                    disabled={!canAct || isSubmittingAck === `${row.staffId}:${row.scriptId}`}
                    className={`px-3 py-1.5 border text-xs rounded-lg transition-colors ${canAct ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/50' : 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >
                    {isSubmittingAck === `${row.staffId}:${row.scriptId}` ? 'Recording…' : row.status === 'current' ? 'Current' : 'Acknowledge current version'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allRows.length > 0 && canManageStaff && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Manager/Admin Matrix</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left py-2 pr-4">Room</th>
                  <th className="text-left py-2 pr-4">Staff</th>
                  <th className="text-left py-2 pr-4">Role</th>
                  <th className="text-left py-2 pr-4">Script</th>
                  <th className="text-left py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {allRows.map((row) => (
                  <tr key={`matrix:${row.staffId}:${row.scriptId}`}>
                    <td className="py-2 pr-4 text-slate-300">{row.roomName}</td>
                    <td className="py-2 pr-4 text-slate-300">{row.staffName}</td>
                    <td className="py-2 pr-4 text-slate-400">{row.staffRole}</td>
                    <td className="py-2 pr-4 text-slate-300">{row.scriptTitle}</td>
                    <td className="py-2 pr-4"><span className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${statusStyles[row.status]}`}>{acknowledgementStatusLabels[row.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
