import { useState, useEffect } from 'react';
import { LayoutDashboard, DoorOpen, BookOpen, File as FileEdit, History, Mic, Layers, Volume2, Users, ShieldCheck, Download, Menu, X, Clock, LogOut, Search } from 'lucide-react';

import { AppState, Room, Script, ScriptVersion, HintLadder, PronunciationTerm, StaffMember, Acknowledgement, AuditEvent } from './types';
import { AuthUser, canManageData, linkAuthUserToStaff } from './lib/auth';
import { markScriptAcknowledgementsSuperseded } from './lib/acknowledgements';
import { canMakeVersionCurrent, calculateSafetyBlockChecksum, validateSafetyBlocks, VersionGovernanceAction } from './lib/versionGovernance';
import { dataAdapter, initialEmptyAppState } from './lib/dataAdapter';
import packageMetadata from '../package.json';
import { ToastProvider } from './lib/toast';

import Dashboard from './components/Dashboard';
import RoomSetup from './components/RoomSetup';
import ScriptLibrary from './components/ScriptLibrary';
import ScriptEditor from './components/ScriptEditor';
import VersionHistory from './components/VersionHistory';
import GMModeReader from './components/GMModeReader';
import HintLadders from './components/HintLadders';
import PronunciationGuide from './components/PronunciationGuide';
import StaffAcknowledgements from './components/StaffAcknowledgements';
import ReadinessAudit from './components/ReadinessAudit';
import ExportCenter from './components/ExportCenter';
import LoginPanel from './components/LoginPanel';
import AuthorizationNotice from './components/AuthorizationNotice';

type Screen =
  | 'dashboard'
  | 'rooms'
  | 'scripts'
  | 'editor'
  | 'history'
  | 'gm'
  | 'hints'
  | 'pronunciation'
  | 'acknowledgements'
  | 'audit'
  | 'export';

const APP_VERSION = packageMetadata.version;

const navItems: { id: Screen; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'rooms', label: 'Room Setup', icon: DoorOpen },
  { id: 'scripts', label: 'Script Library', icon: BookOpen },
  { id: 'editor', label: 'Script Editor', icon: FileEdit },
  { id: 'history', label: 'Version History', icon: History },
  { id: 'gm', label: 'GM Mode', icon: Mic },
  { id: 'hints', label: 'Hint Ladders', icon: Layers },
  { id: 'pronunciation', label: 'Pronunciation', icon: Volume2 },
  { id: 'acknowledgements', label: 'Staff Acks', icon: Users },
  { id: 'audit', label: 'Readiness Audit', icon: ShieldCheck },
  { id: 'export', label: 'Export Center', icon: Download },
];

export default function App() {
  const [state, setState] = useState<AppState>(initialEmptyAppState);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [quickNavValue, setQuickNavValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => dataAdapter.getAuthStatus().user);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);

  const currentUser = linkAuthUserToStaff(authUser, state.staffMembers);
  const isProductionUnauthenticated = !dataAdapter.isDemo && !currentUser?.isAuthenticated;
  const canManage = canManageData(currentUser);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      if (!dataAdapter.isDemo && !authUser?.isAuthenticated) {
        setState(initialEmptyAppState);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const loadedState = await dataAdapter.loadAppState();
        if (!cancelled) setState(loadedState);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load application data.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (isLoading || loadError || isProductionUnauthenticated) return;

    let cancelled = false;

    async function persistState() {
      setSaveStatus('saving');
      try {
        await dataAdapter.saveAppState(state);
        if (!cancelled) setSaveStatus('saved');
      } catch {
        if (!cancelled) setSaveStatus('error');
      }
    }

    void persistState();

    return () => {
      cancelled = true;
    };
  }, [isLoading, loadError, isProductionUnauthenticated, state]);

  function navigate(s: string) {
    setScreen(s as Screen);
    setQuickNavValue('');
    setMobileNavOpen(false);
  }

  function navigateToEditor(scriptId?: string) {
    setEditingScriptId(scriptId ?? null);
    setScreen('editor');
  }

  async function handleLogin(email: string, password: string) {
    if (!dataAdapter.login) return;
    setIsLoginSubmitting(true);
    setAuthError(null);
    try {
      const authStatus = await dataAdapter.login({ email, password });
      if (!authStatus.user) throw new Error('PocketBase accepted the login but did not return an authenticated user.');
      setAuthUser(authStatus.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in. Check your email and password.');
    } finally {
      setIsLoginSubmitting(false);
    }
  }

  async function handleLogout() {
    if (dataAdapter.logout) await dataAdapter.logout();
    setAuthUser(null);
    setState(initialEmptyAppState);
    setScreen('dashboard');
    setEditingScriptId(null);
  }

  function addRoom(room: Room) {
    setState((s) => ({
      ...s,
      rooms: [...s.rooms, room],
      auditEvents: [...(s.auditEvents ?? []), buildAuditEvent('create', 'room', room.id, `Created room ${room.name}`, { status: room.status, durationMinutes: room.durationMinutes })],
    }));
  }

  function updateRoom(room: Room) {
    setState((s) => {
      const previous = s.rooms.find((r) => r.id === room.id);
      const action: AuditEvent['action'] = room.status === 'retired' && previous?.status !== 'retired' ? 'archive' : 'update';
      return {
        ...s,
        rooms: s.rooms.map((r) => (r.id === room.id ? room : r)),
        auditEvents: [
          ...(s.auditEvents ?? []),
          buildAuditEvent(action, 'room', room.id, `${action === 'archive' ? 'Retired' : 'Updated'} room ${room.name}`, {
            previousStatus: previous?.status,
            nextStatus: room.status,
            durationMinutes: room.durationMinutes,
          }),
        ],
      };
    });
  }

  function saveScript(script: Script) {
    setState((s) => {
      const exists = s.scripts.find((sc) => sc.id === script.id);
      if (exists) {
        return { ...s, scripts: s.scripts.map((sc) => (sc.id === script.id ? script : sc)) };
      }
      return { ...s, scripts: [...s.scripts, script] };
    });
  }

  function buildAuditEvent(action: AuditEvent['action'], entityType: AuditEvent['entityType'], entityId: string, summary: string, metadata: Record<string, unknown> = {}): AuditEvent {
    return {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      entityType,
      entityId,
      actorStaffId: currentUser?.staffMemberId ?? null,
      actorAuthUserId: currentUser?.authUserId ?? null,
      summary,
      metadata,
      createdAt: new Date().toISOString(),
    };
  }

  function saveVersion(version: ScriptVersion) {
    const versionWithChecksum: ScriptVersion = {
      ...version,
      safetyBlockChecksum: version.safetyBlockChecksum || calculateSafetyBlockChecksum(version.requiredBlocks, version.bodyMarkdown),
    };
    setState((s) => {
      const exists = s.scriptVersions.find((v) => v.id === version.id);
      const script = s.scripts.find((candidate) => candidate.id === version.scriptId);
      const auditAction: AuditEvent['action'] = version.aiRewrite?.assisted ? 'ai_assist' : (version.approvalStatus === 'in_review' ? 'submit' : 'create');
      const auditVerb = auditAction === 'ai_assist' ? 'Created AI-assisted draft' : (auditAction === 'submit' ? 'Submitted' : 'Created');
      const auditEvent = buildAuditEvent(
        auditAction,
        'script_version',
        version.id,
        `${auditVerb} v${version.versionNumber}${script ? ` for ${script.title}` : ''}`,
        {
          scriptId: version.scriptId,
          versionNumber: version.versionNumber,
          approvalStatus: version.approvalStatus,
          aiRewrite: version.aiRewrite ?? null,
        }
      );
      if (exists) {
        return { ...s, scriptVersions: s.scriptVersions.map((v) => (v.id === version.id ? versionWithChecksum : v)), auditEvents: [...(s.auditEvents ?? []), auditEvent] };
      }
      return { ...s, scriptVersions: [...s.scriptVersions, versionWithChecksum], auditEvents: [...(s.auditEvents ?? []), auditEvent] };
    });
  }

  function updateVersionGovernance(versionId: string, action: VersionGovernanceAction, notes?: string) {
    setState((s) => {
      const version = s.scriptVersions.find((candidate) => candidate.id === versionId);
      if (!version) return s;
      const script = s.scripts.find((candidate) => candidate.id === version.scriptId);
      const previousVersion = version.previousVersionId ? s.scriptVersions.find((candidate) => candidate.id === version.previousVersionId) ?? null : null;
      const now = new Date().toISOString();
      let nextVersion: ScriptVersion = version;
      let auditAction: AuditEvent['action'] = action === 'make-current' ? 'make-current' : action;
      let summary = `${action} v${version.versionNumber}${script ? ` for ${script.title}` : ''}`;

      if (action === 'submit') {
        nextVersion = { ...version, approvalStatus: 'in_review', submittedBy: currentUser?.staffMemberId ?? version.submittedBy };
        summary = `Submitted v${version.versionNumber}${script ? ` for ${script.title}` : ''} for review`;
      }

      if (action === 'approve') {
        const safety = validateSafetyBlocks(version, previousVersion);
        if (!safety.valid) return s;
        nextVersion = {
          ...version,
          approvalStatus: 'approved',
          approvedBy: currentUser?.name ?? 'Unknown approver',
          approvedAt: now,
          reviewedBy: currentUser?.staffMemberId,
          rejectedAt: null,
          safetyBlockChecksum: safety.checksum,
        };
        auditAction = 'approve';
        summary = `Approved v${version.versionNumber}${script ? ` for ${script.title}` : ''}`;
      }

      if (action === 'reject') {
        nextVersion = { ...version, approvalStatus: 'rejected', reviewedBy: currentUser?.staffMemberId, rejectedAt: now };
        auditAction = 'reject';
        summary = `Rejected v${version.versionNumber}${script ? ` for ${script.title}` : ''}`;
      }

      if (action === 'archive') {
        nextVersion = { ...version, approvalStatus: 'archived' };
        auditAction = 'archive';
        summary = `Archived v${version.versionNumber}${script ? ` for ${script.title}` : ''}`;
      }

      const auditEvent = buildAuditEvent(auditAction, 'script_version', version.id, summary, {
        scriptId: version.scriptId,
        versionNumber: version.versionNumber,
        previousStatus: version.approvalStatus,
        nextStatus: nextVersion.approvalStatus,
        notes,
      });

      return {
        ...s,
        scriptVersions: s.scriptVersions.map((candidate) => (candidate.id === versionId ? nextVersion : candidate)),
        auditEvents: [...(s.auditEvents ?? []), auditEvent],
      };
    });
  }

  function setCurrentVersion(scriptId: string, versionId: string) {
    setState((s) => {
      const script = s.scripts.find((candidate) => candidate.id === scriptId);
      const targetVersion = s.scriptVersions.find((candidate) => candidate.id === versionId);
      if (!script || !targetVersion || !canMakeVersionCurrent(targetVersion)) return s;
      const now = new Date().toISOString();
      const isRollback = Boolean(script.currentVersionId && targetVersion.createdAt < (s.scriptVersions.find((candidate) => candidate.id === script.currentVersionId)?.createdAt ?? targetVersion.createdAt));
      const auditEvent = buildAuditEvent(isRollback ? 'rollback' : 'make-current', 'script_version', versionId, `${isRollback ? 'Rolled back' : 'Made'} ${script.title} current at v${targetVersion.versionNumber}`, {
        scriptId,
        previousVersionId: script.currentVersionId,
        newVersionId: versionId,
      });
      return {
        ...s,
        scripts: s.scripts.map((sc) =>
          sc.id === scriptId
            ? { ...sc, currentVersionId: versionId, status: 'current', updatedAt: now }
            : sc
        ),
        scriptVersions: s.scriptVersions.map((v) =>
          v.scriptId === scriptId
            ? { ...v, approvalStatus: v.id === versionId ? 'current' : (v.id === script.currentVersionId && v.approvalStatus === 'current' ? 'archived' : v.approvalStatus) }
            : v
        ),
        acknowledgements: markScriptAcknowledgementsSuperseded(s.acknowledgements, scriptId, versionId),
        auditEvents: [...(s.auditEvents ?? []), auditEvent],
      };
    });
  }

  function addHintLadder(ladder: HintLadder) {
    setState((s) => ({
      ...s,
      hintLadders: [...s.hintLadders, ladder],
      auditEvents: [...(s.auditEvents ?? []), buildAuditEvent('create', 'hint_ladder', ladder.id, `Created hint ladder ${ladder.puzzleLabel}`, { roomId: ladder.roomId, hintCount: ladder.hints.length })],
    }));
  }

  function updateHintLadder(ladder: HintLadder) {
    setState((s) => {
      const previous = s.hintLadders.find((h) => h.id === ladder.id);
      const archived = ladder.notes.includes('[ARCHIVED]') && !previous?.notes.includes('[ARCHIVED]');
      return {
        ...s,
        hintLadders: s.hintLadders.map((h) => (h.id === ladder.id ? ladder : h)),
        auditEvents: [
          ...(s.auditEvents ?? []),
          buildAuditEvent(archived ? 'archive' : 'update', 'hint_ladder', ladder.id, `${archived ? 'Archived' : 'Updated'} hint ladder ${ladder.puzzleLabel}`, {
            roomId: ladder.roomId,
            hintCount: ladder.hints.length,
            previousPuzzleLabel: previous?.puzzleLabel,
          }),
        ],
      };
    });
  }

  function addPronunciationTerm(term: PronunciationTerm) {
    setState((s) => ({
      ...s,
      pronunciationTerms: [...s.pronunciationTerms, term],
      auditEvents: [...(s.auditEvents ?? []), buildAuditEvent('create', 'pronunciation_term', term.id, `Created pronunciation term ${term.term}`, { roomId: term.roomId, hasAudioUrl: Boolean(term.audioNoteUrl) })],
    }));
  }

  function updatePronunciationTerm(term: PronunciationTerm) {
    setState((s) => {
      const previous = s.pronunciationTerms.find((t) => t.id === term.id);
      const archived = term.deliveryNote.includes('[ARCHIVED]') && !previous?.deliveryNote.includes('[ARCHIVED]');
      return {
        ...s,
        pronunciationTerms: s.pronunciationTerms.map((t) => (t.id === term.id ? term : t)),
        auditEvents: [
          ...(s.auditEvents ?? []),
          buildAuditEvent(archived ? 'archive' : 'update', 'pronunciation_term', term.id, `${archived ? 'Archived' : 'Updated'} pronunciation term ${term.term}`, {
            roomId: term.roomId,
            previousTerm: previous?.term,
            hasAudioUrl: Boolean(term.audioNoteUrl),
          }),
        ],
      };
    });
  }

  async function addAcknowledgement(ack: Acknowledgement, auditEvent: AuditEvent) {
    if (dataAdapter.createAcknowledgement) {
      const persisted = await dataAdapter.createAcknowledgement(ack, auditEvent);
      setState((s) => ({
        ...s,
        acknowledgements: [...s.acknowledgements, persisted.acknowledgement],
        auditEvents: [...(s.auditEvents ?? []), persisted.auditEvent],
      }));
      return;
    }

    setState((s) => ({
      ...s,
      acknowledgements: [...s.acknowledgements, ack],
      auditEvents: [...(s.auditEvents ?? []), auditEvent],
    }));
  }

  function addStaffMember(staff: StaffMember) {
    setState((s) => ({ ...s, staffMembers: [...s.staffMembers, staff] }));
  }

  async function restoreDemoData() {
    if (!dataAdapter.resetDemoData) return;
    const fresh = await dataAdapter.resetDemoData();
    setState(fresh);
  }

  function applyImportedState(importedState: AppState) {
    setState(importedState);
  }

  const isGMMode = screen === 'gm';
  const isAppEmpty = Object.values(state).every((collection) => collection.length === 0);

  if (isProductionUnauthenticated) {
    return (
      <ToastProvider>
        <LoginPanel
          appLabel={dataAdapter.label}
          error={authError}
          isSubmitting={isLoginSubmitting}
          onLogin={handleLogin}
        />
      </ToastProvider>
    );
  }

  if (isLoading) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md text-center shadow-xl">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-3 animate-pulse" />
            <h1 className="text-lg font-semibold text-slate-100">Loading GM Script Library</h1>
            <p className="text-sm text-slate-500 mt-2">Connecting to {dataAdapter.label} persistence.</p>
          </div>
        </div>
      </ToastProvider>
    );
  }

  if (loadError) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
          <div className="bg-slate-900 border border-red-900/60 rounded-xl p-6 max-w-lg shadow-xl">
            <h1 className="text-lg font-semibold text-red-200">Unable to load application data</h1>
            <p className="text-sm text-slate-400 mt-2">{loadError}</p>
            <p className="text-xs text-slate-500 mt-3">
              Check the selected data mode, PocketBase URL, and collection availability, then refresh the app.
            </p>
          </div>
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {isGMMode ? (
          <div>
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
              <span className="text-xs text-slate-500">GM Script Library</span>
              <button
                onClick={() => navigate('dashboard')}
                aria-label="Exit GM Mode"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-3 h-3" /> Exit GM Mode
              </button>
            </div>
            <GMModeReader state={state} />
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden">
            <aside
              className={`
                fixed inset-y-0 left-0 z-30 w-56 bg-slate-900 border-r border-slate-800 flex flex-col
                transform transition-transform duration-200
                ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:relative lg:translate-x-0 lg:flex
              `}
            >
              <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 leading-tight">GM Script</div>
                  <div className="text-xs text-slate-500 leading-tight">Library · v{APP_VERSION}</div>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto py-3 px-2">
                {navItems.map(({ id, label, icon: Icon }) => {
                  const active = screen === id;
                  return (
                    <button
                      key={id}
                      onClick={() => navigate(id)}
                      aria-current={active ? 'page' : undefined}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400
                        ${active
                          ? 'bg-slate-800 text-slate-100 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-slate-300' : 'text-slate-500'}`} />
                      {label}
                    </button>
                  );
                })}
              </nav>

              <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600 space-y-2">
                {dataAdapter.isDemo && (
                  <div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">
                    Demo Mode
                  </div>
                )}
                <div>MJW Platform · v{APP_VERSION}</div>
              </div>
            </aside>

            {mobileNavOpen && (
              <div
                className="fixed inset-0 z-20 bg-black/60 lg:hidden"
                onClick={() => setMobileNavOpen(false)}
              />
            )}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <header className="flex items-center gap-3 px-4 sm:px-6 py-4 bg-slate-900 border-b border-slate-800 flex-shrink-0">
                <button
                  className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-sm font-semibold text-slate-300 capitalize">
                  {navItems.find((n) => n.id === screen)?.label ?? 'GM Script Library'}
                </h1>
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                  <label className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
                    <Search className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span className="sr-only">Quick navigation</span>
                    <select
                      value={quickNavValue}
                      onChange={(event) => {
                        const nextScreen = event.target.value;
                        setQuickNavValue(nextScreen);
                        if (nextScreen) navigate(nextScreen);
                      }}
                      className="max-w-36 bg-transparent text-xs text-slate-200 focus:outline-none"
                      aria-label="Quick navigation"
                    >
                      <option value="">Jump to screen…</option>
                      {navItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  {dataAdapter.isDemo && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-medium text-amber-300">
                      Demo Mode
                    </span>
                  )}
                  <span className="hidden md:inline-flex rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-slate-400">
                    v{APP_VERSION}
                  </span>
                  {currentUser && (
                    <span className="hidden sm:inline-flex rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300">
                      {currentUser.name} · {currentUser.permissionLevel}
                    </span>
                  )}
                  <span aria-live="polite">
                    {saveStatus === 'saving' && 'Saving…'}
                    {saveStatus === 'saved' && 'Saved'}
                    {saveStatus === 'error' && 'Save failed'}
                    {saveStatus === 'idle' && dataAdapter.label}
                  </span>
                  {!dataAdapter.isDemo && (
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <LogOut className="w-3 h-3" /> Logout
                    </button>
                  )}
                </div>
              </header>

              <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                  {saveStatus === 'error' && (
                    <div className="mb-5 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      Changes are visible locally but could not be saved to {dataAdapter.label}. Check the backend connection before continuing operational work.
                    </div>
                  )}
                  {isAppEmpty && (
                    <div className="mb-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-5 py-4">
                      <h2 className="text-sm font-semibold text-slate-200">No library data found</h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Create rooms and scripts to begin, or restore the sample data when running in demo mode.
                      </p>
                      {dataAdapter.resetDemoData && (
                        <button
                          type="button"
                          onClick={() => void restoreDemoData()}
                          className="mt-3 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          Restore Demo Data
                        </button>
                      )}
                    </div>
                  )}
                  {screen === 'dashboard' && (
                    <Dashboard state={state} onNavigate={navigate} />
                  )}
                  {screen === 'rooms' && (
                    canManage ? (
                      <RoomSetup state={state} onAddRoom={addRoom} onUpdateRoom={updateRoom} />
                    ) : (
                      <AuthorizationNotice title="Manager access required" message="Room setup changes are protected in production. Ask an Owner or Manager to update room records." />
                    )
                  )}
                  {screen === 'scripts' && (
                    <ScriptLibrary state={state} onNavigateToEditor={navigateToEditor} />
                  )}
                  {screen === 'editor' && (
                    canManage ? (
                      <ScriptEditor
                        state={state}
                        editingScriptId={editingScriptId}
                        currentUser={currentUser}
                        onSaveScript={saveScript}
                        onSaveVersion={saveVersion}
                        onSetCurrentVersion={setCurrentVersion}
                      />
                    ) : (
                      <AuthorizationNotice title="Manager access required" message="Creating, editing, approving, and publishing scripts requires Manager or Owner permissions." />
                    )
                  )}
                  {screen === 'history' && (
                    <VersionHistory state={state} currentUser={currentUser} onSetCurrentVersion={setCurrentVersion} onUpdateVersionGovernance={updateVersionGovernance} />
                  )}
                  {screen === 'hints' && (
                    canManage ? (
                      <HintLadders
                        state={state}
                        onAddLadder={addHintLadder}
                        onUpdateLadder={updateHintLadder}
                      />
                    ) : (
                      <AuthorizationNotice title="Manager access required" message="Hint ladder editing is protected so operational puzzle support stays controlled." />
                    )
                  )}
                  {screen === 'pronunciation' && (
                    canManage ? (
                      <PronunciationGuide
                        state={state}
                        onAddTerm={addPronunciationTerm}
                        onUpdateTerm={updatePronunciationTerm}
                      />
                    ) : (
                      <AuthorizationNotice title="Manager access required" message="Pronunciation guide editing is protected in production. Staff can still read scripts in GM mode." />
                    )
                  )}
                  {screen === 'acknowledgements' && (
                    <StaffAcknowledgements
                      state={state}
                      currentUser={currentUser}
                      onAcknowledge={addAcknowledgement}
                      onAddStaff={addStaffMember}
                    />
                  )}
                  {screen === 'audit' && (
                    <ReadinessAudit state={state} onNavigate={navigate} />
                  )}
                  {screen === 'export' && (
                    canManage ? (
                      <ExportCenter
                        state={state}
                        isDemoMode={dataAdapter.isDemo}
                        onRestoreDemoData={dataAdapter.resetDemoData ? restoreDemoData : undefined}
                        onApplyImportedState={applyImportedState}
                      />
                    ) : (
                      <AuthorizationNotice title="Manager access required" message="Exports can include operational scripts and training data, so this screen is limited to Managers and Owners." />
                    )
                  )}
                </div>
              </main>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
