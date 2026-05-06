import { useState, useEffect } from 'react';
import { LayoutDashboard, DoorOpen, BookOpen, File as FileEdit, History, Mic, Layers, Volume2, Users, ShieldCheck, Download, Menu, X, Clock } from 'lucide-react';

import { AppState, Room, Script, ScriptVersion, HintLadder, PronunciationTerm, StaffMember, Acknowledgement } from './types';
import { sampleData } from './data/sampleData';

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

const STORAGE_KEY = 'gm_script_library_v1';

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

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as AppState;
  } catch {
    // fall through to sample data
  }
  return sampleData;
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  function navigate(s: string) {
    setScreen(s as Screen);
    setMobileNavOpen(false);
  }

  function navigateToEditor(scriptId?: string) {
    setEditingScriptId(scriptId ?? null);
    setScreen('editor');
  }

  function addRoom(room: Room) {
    setState((s) => ({ ...s, rooms: [...s.rooms, room] }));
  }

  function updateRoom(room: Room) {
    setState((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === room.id ? room : r)) }));
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

  function saveVersion(version: ScriptVersion) {
    setState((s) => {
      const exists = s.scriptVersions.find((v) => v.id === version.id);
      if (exists) {
        return { ...s, scriptVersions: s.scriptVersions.map((v) => (v.id === version.id ? version : v)) };
      }
      return { ...s, scriptVersions: [...s.scriptVersions, version] };
    });
  }

  function setCurrentVersion(scriptId: string, versionId: string) {
    setState((s) => ({
      ...s,
      scripts: s.scripts.map((sc) =>
        sc.id === scriptId
          ? { ...sc, currentVersionId: versionId, status: 'current', updatedAt: new Date().toISOString() }
          : sc
      ),
      scriptVersions: s.scriptVersions.map((v) =>
        v.scriptId === scriptId
          ? { ...v, approvalStatus: v.id === versionId ? 'approved' : v.approvalStatus }
          : v
      ),
    }));
  }

  function addHintLadder(ladder: HintLadder) {
    setState((s) => ({ ...s, hintLadders: [...s.hintLadders, ladder] }));
  }

  function updateHintLadder(ladder: HintLadder) {
    setState((s) => ({
      ...s,
      hintLadders: s.hintLadders.map((h) => (h.id === ladder.id ? ladder : h)),
    }));
  }

  function addPronunciationTerm(term: PronunciationTerm) {
    setState((s) => ({ ...s, pronunciationTerms: [...s.pronunciationTerms, term] }));
  }

  function updatePronunciationTerm(term: PronunciationTerm) {
    setState((s) => ({
      ...s,
      pronunciationTerms: s.pronunciationTerms.map((t) => (t.id === term.id ? term : t)),
    }));
  }

  function addAcknowledgement(ack: Acknowledgement) {
    setState((s) => ({ ...s, acknowledgements: [...s.acknowledgements, ack] }));
  }

  function addStaffMember(staff: StaffMember) {
    setState((s) => ({ ...s, staffMembers: [...s.staffMembers, staff] }));
  }

  const isGMMode = screen === 'gm';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {isGMMode ? (
        <div>
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
            <span className="text-xs text-slate-500">GM Script Library</span>
            <button
              onClick={() => navigate('dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3 h-3" /> Exit GM Mode
            </button>
          </div>
          <GMModeReader state={state} />
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
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
                <div className="text-xs text-slate-500 leading-tight">Library</div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-2">
              {navItems.map(({ id, label, icon: Icon }) => {
                const active = screen === id;
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all
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

            <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600">
              MJW Platform · v1.0
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
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-sm font-semibold text-slate-300 capitalize">
                {navItems.find((n) => n.id === screen)?.label ?? 'GM Script Library'}
              </h1>
            </header>

            <main className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {screen === 'dashboard' && (
                  <Dashboard state={state} onNavigate={navigate} />
                )}
                {screen === 'rooms' && (
                  <RoomSetup state={state} onAddRoom={addRoom} onUpdateRoom={updateRoom} />
                )}
                {screen === 'scripts' && (
                  <ScriptLibrary state={state} onNavigateToEditor={navigateToEditor} />
                )}
                {screen === 'editor' && (
                  <ScriptEditor
                    state={state}
                    editingScriptId={editingScriptId}
                    onSaveScript={saveScript}
                    onSaveVersion={saveVersion}
                    onSetCurrentVersion={setCurrentVersion}
                  />
                )}
                {screen === 'history' && (
                  <VersionHistory state={state} onSetCurrentVersion={setCurrentVersion} />
                )}
                {screen === 'hints' && (
                  <HintLadders
                    state={state}
                    onAddLadder={addHintLadder}
                    onUpdateLadder={updateHintLadder}
                  />
                )}
                {screen === 'pronunciation' && (
                  <PronunciationGuide
                    state={state}
                    onAddTerm={addPronunciationTerm}
                    onUpdateTerm={updatePronunciationTerm}
                  />
                )}
                {screen === 'acknowledgements' && (
                  <StaffAcknowledgements
                    state={state}
                    onAcknowledge={addAcknowledgement}
                    onAddStaff={addStaffMember}
                  />
                )}
                {screen === 'audit' && (
                  <ReadinessAudit state={state} />
                )}
                {screen === 'export' && (
                  <ExportCenter state={state} />
                )}
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
