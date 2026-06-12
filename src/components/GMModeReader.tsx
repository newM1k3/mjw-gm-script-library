import { ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, ChevronDown, Layers, Maximize2, Moon, ShieldCheck, Sun, Type, Volume2, X } from 'lucide-react';
import { AppState, HintLadder, Script, ScriptType, ScriptVersion } from '../types';

interface Props {
  state: AppState;
}

const scriptTypeLabels: Record<ScriptType, string> = {
  pre_game_brief: 'Pre-Game Brief',
  safety_brief: 'Safety Brief',
  story_intro: 'Story Intro',
  character_intro: 'Character Intro',
  hint_ladder: 'Hint Ladder',
  mid_game_intervention: 'Mid-Game Intervention',
  post_game_debrief: 'Post-Game Debrief',
  reset_note: 'Reset Note',
  training_note: 'Training Note',
};

const scriptTypeOrder: ScriptType[] = [
  'safety_brief',
  'pre_game_brief',
  'story_intro',
  'character_intro',
  'mid_game_intervention',
  'hint_ladder',
  'post_game_debrief',
  'reset_note',
  'training_note',
];

const quickJumpTypes: ScriptType[] = [
  'safety_brief',
  'pre_game_brief',
  'story_intro',
  'mid_game_intervention',
  'post_game_debrief',
  'reset_note',
  'training_note',
];

type CurrentScriptOption = {
  script: Script;
  version: ScriptVersion;
};

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

function isOperationalCurrent(version: ScriptVersion | undefined): version is ScriptVersion {
  return Boolean(version && (version.approvalStatus === 'approved' || version.approvalStatus === 'current') && version.approvedAt);
}

function getCurrentScriptOptions(state: AppState, roomId: string, type: ScriptType): CurrentScriptOption[] {
  return state.scripts
    .filter((script) => script.roomId === roomId && script.scriptType === type && script.currentVersionId)
    .map((script) => {
      const version = state.scriptVersions.find((candidate) => candidate.id === script.currentVersionId);
      return version && isOperationalCurrent(version) ? { script, version } : null;
    })
    .filter((option): option is CurrentScriptOption => option !== null)
    .sort((a, b) => a.script.title.localeCompare(b.script.title));
}

function sanitizeMarkdownText(text: string): string {
  return Array.from(text)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 10 || code === 13 || code === 9 || (code >= 32 && code !== 127);
    })
    .join('');
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key} className="italic opacity-80">{token.slice(1, -1)}</em>);
    } else {
      nodes.push(<code key={key} className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[0.85em]">{token.slice(1, -1)}</code>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function SafeMarkdown({ text }: { text: string }) {
  const blocks = sanitizeMarkdownText(text).split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const key = `${index}-${block.slice(0, 12)}`;
        if (block.startsWith('### ')) {
          return <h3 key={key} className="mt-8 text-2xl font-bold text-current">{renderInlineMarkdown(block.slice(4))}</h3>;
        }
        if (block.startsWith('## ')) {
          return <h2 key={key} className="mt-8 text-3xl font-bold text-current">{renderInlineMarkdown(block.slice(3))}</h2>;
        }
        if (block.startsWith('# ')) {
          return <h1 key={key} className="mt-6 text-4xl font-bold text-current">{renderInlineMarkdown(block.slice(2))}</h1>;
        }
        if (block.startsWith('> ')) {
          return (
            <blockquote key={key} className="border-l-4 border-current/30 pl-4 italic opacity-80">
              {renderInlineMarkdown(block.replace(/^>\s?/gm, ''))}
            </blockquote>
          );
        }
        if (block.split('\n').every((line) => /^-\s+/.test(line))) {
          return (
            <ul key={key} className="list-disc space-y-2 pl-6">
              {block.split('\n').map((line, lineIndex) => <li key={lineIndex}>{renderInlineMarkdown(line.replace(/^-\s+/, ''))}</li>)}
            </ul>
          );
        }
        if (block.split('\n').every((line) => /^\d+\.\s+/.test(line))) {
          return (
            <ol key={key} className="list-decimal space-y-2 pl-6">
              {block.split('\n').map((line, lineIndex) => <li key={lineIndex}>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>)}
            </ol>
          );
        }
        return <p key={key} className="whitespace-pre-line">{renderInlineMarkdown(block)}</p>;
      })}
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unapproved';
  return new Date(value).toLocaleDateString();
}

function firstHintLadderId(ladders: HintLadder[]): string {
  return ladders[0]?.id ?? '';
}

export default function GMModeReader({ state }: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState(state.rooms[0]?.id ?? '');
  const [selectedType, setSelectedType] = useState<ScriptType>('pre_game_brief');
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [selectedHintLadderId, setSelectedHintLadderId] = useState('');
  const [teleprompterMode, setTeleprompterMode] = useState(false);
  const [fontSize, setFontSize] = useState(24);
  const [lineHeight, setLineHeight] = useState(1.65);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockMessage, setWakeLockMessage] = useState('Screen wake lock has not been requested. Keep device power settings in mind before a live game.');

  const room = state.rooms.find((candidate) => candidate.id === selectedRoomId);
  const currentScriptOptions = useMemo(() => getCurrentScriptOptions(state, selectedRoomId, selectedType), [state, selectedRoomId, selectedType]);
  const selectedOption = currentScriptOptions.find((option) => option.script.id === selectedScriptId) ?? currentScriptOptions[0] ?? null;
  const currentScript = selectedOption?.script ?? null;
  const currentVersion = selectedOption?.version ?? null;
  const pronunciationTerms = state.pronunciationTerms.filter((term) => term.roomId === selectedRoomId && !term.deliveryNote.includes('[ARCHIVED]'));
  const roomHintLadders = useMemo(() => state.hintLadders.filter((ladder) => ladder.roomId === selectedRoomId && !ladder.notes.includes('[ARCHIVED]')), [state.hintLadders, selectedRoomId]);
  const selectedHintLadder = roomHintLadders.find((ladder) => ladder.id === selectedHintLadderId) ?? roomHintLadders[0];
  const availableTypes = scriptTypeOrder.filter((type) => getCurrentScriptOptions(state, selectedRoomId, type).length > 0);
  const quickJumpAvailableTypes = quickJumpTypes.filter((type) => getCurrentScriptOptions(state, selectedRoomId, type).length > 0);

  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(selectedType)) {
      setSelectedType(availableTypes[0]);
    }
  }, [availableTypes, selectedType]);

  useEffect(() => {
    if (currentScriptOptions.length > 0 && !currentScriptOptions.some((option) => option.script.id === selectedScriptId)) {
      setSelectedScriptId(currentScriptOptions[0].script.id);
    }
  }, [currentScriptOptions, selectedScriptId]);

  useEffect(() => {
    if (!roomHintLadders.some((ladder) => ladder.id === selectedHintLadderId)) {
      setSelectedHintLadderId(firstHintLadderId(roomHintLadders));
    }
  }, [roomHintLadders, selectedHintLadderId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'GM Mode is active. Confirm before leaving the live game reader.';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const wakeLockNavigator = navigator as WakeLockNavigator;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    async function requestWakeLock() {
      if (!teleprompterMode) {
        setWakeLockActive(false);
        setWakeLockMessage('Screen wake lock has not been requested. Keep device power settings in mind before a live game.');
        return;
      }
      if (!wakeLockNavigator.wakeLock) {
        setWakeLockActive(false);
        setWakeLockMessage('This browser does not support Wake Lock. Use device display settings to keep the screen awake.');
        return;
      }
      try {
        sentinel = await wakeLockNavigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setWakeLockActive(true);
        setWakeLockMessage('Screen wake lock is active while teleprompter mode is open.');
        sentinel.addEventListener?.('release', () => {
          setWakeLockActive(false);
          setWakeLockMessage('Wake lock was released by the browser or operating system.');
        });
      } catch {
        setWakeLockActive(false);
        setWakeLockMessage('Wake lock request was blocked. Keep the device awake manually before live delivery.');
      }
    }

    void requestWakeLock();
    return () => {
      cancelled = true;
      if (sentinel) void sentinel.release();
    };
  }, [teleprompterMode]);

  const bg = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900';
  const border = darkMode ? 'border-slate-700' : 'border-slate-200';
  const controlBg = darkMode ? 'bg-slate-900' : 'bg-slate-50';
  const selectCls = darkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-800';
  const btnBase = darkMode ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50';
  const btnActive = darkMode ? 'bg-blue-700 border-blue-600 text-white' : 'bg-blue-600 border-blue-500 text-white';

  const spoilerColors: Record<string, string> = {
    low: darkMode ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
    medium: darkMode ? 'bg-amber-900/40 border-amber-700/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700',
    high: darkMode ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700',
  };

  function openHints() {
    if (!selectedHintLadderId && roomHintLadders.length > 0) setSelectedHintLadderId(roomHintLadders[0].id);
    setShowHints((value) => !value);
    setShowPronunciation(false);
  }

  return (
    <div className={`min-h-screen pb-24 ${bg} transition-colors`}>
      <div className={`sticky top-0 z-20 ${controlBg} border-b ${border} px-3 py-2.5 sm:px-4 sm:py-3`}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <BookOpen className={`h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <span className={`hidden text-xs font-semibold sm:inline sm:text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>GM Mode</span>

          <select
            aria-label="Select room"
            className={`min-w-32 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none sm:max-w-xs ${selectCls}`}
            value={selectedRoomId}
            onChange={(event) => {
              const nextRoomId = event.target.value;
              const firstType = scriptTypeOrder.find((type) => getCurrentScriptOptions(state, nextRoomId, type).length > 0) ?? 'pre_game_brief';
              setSelectedRoomId(nextRoomId);
              setSelectedType(firstType);
              setSelectedScriptId('');
              setSelectedHintLadderId('');
            }}
          >
            {state.rooms.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>

          <select
            aria-label="Select script type"
            className={`min-w-32 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none sm:max-w-xs ${selectCls}`}
            value={selectedType}
            onChange={(event) => { setSelectedType(event.target.value as ScriptType); setSelectedScriptId(''); }}
          >
            {(availableTypes.length > 0 ? availableTypes : scriptTypeOrder).map((type) => <option key={type} value={type}>{scriptTypeLabels[type]}</option>)}
          </select>

          {currentScriptOptions.length > 1 && (
            <select
              aria-label="Select script family"
              className={`min-w-40 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none sm:max-w-xs ${selectCls}`}
              value={selectedOption?.script.id ?? ''}
              onChange={(event) => setSelectedScriptId(event.target.value)}
            >
              {currentScriptOptions.map((option) => <option key={option.script.id} value={option.script.id}>{option.script.title}</option>)}
            </select>
          )}

          <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
            {pronunciationTerms.length > 0 && (
              <button
                onClick={() => { setShowPronunciation(!showPronunciation); setShowHints(false); }}
                aria-label="Toggle pronunciation guide"
                aria-pressed={showPronunciation}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors sm:gap-1.5 sm:px-3 ${showPronunciation ? btnActive : btnBase}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pronounce</span>
              </button>
            )}
            {roomHintLadders.length > 0 && (
              <button
                onClick={openHints}
                aria-label="Toggle hint ladders"
                aria-pressed={showHints}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-colors sm:gap-1.5 sm:px-3 ${showHints ? btnActive : btnBase}`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hints</span>
              </button>
            )}
            <button
              onClick={() => setTeleprompterMode(!teleprompterMode)}
              aria-label="Toggle teleprompter mode"
              aria-pressed={teleprompterMode}
              className={`rounded-lg border p-1.5 transition-colors ${teleprompterMode ? btnActive : btnBase}`}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`rounded-lg border p-1.5 transition-colors ${btnBase}`}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {quickJumpAvailableTypes.length > 0 && (
          <div className="mx-auto mt-2 flex max-w-5xl gap-1.5 overflow-x-auto pb-1">
            {quickJumpAvailableTypes.map((type) => (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setSelectedScriptId(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-shrink-0 rounded-full border px-3 py-1 text-[11px] transition-colors ${selectedType === type ? btnActive : btnBase}`}
              >
                {scriptTypeLabels[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {teleprompterMode && (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b px-3 py-3 sm:px-4`}>
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`flex items-start gap-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <Type className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{wakeLockMessage}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2">
                <span>Font</span>
                <input aria-label="Teleprompter font size" type="range" min="20" max="42" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
                <span className="w-8">{fontSize}px</span>
              </label>
              <label className="flex items-center gap-2">
                <span>Lines</span>
                <input aria-label="Teleprompter line height" type="range" min="1.3" max="2" step="0.05" value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} />
                <span className="w-8">{lineHeight.toFixed(2)}</span>
              </label>
              <span className={`rounded-full border px-2 py-1 ${wakeLockActive ? 'border-emerald-700/50 text-emerald-300' : 'border-amber-700/50 text-amber-300'}`}>{wakeLockActive ? 'Awake' : 'Manual awake'}</span>
            </div>
          </div>
        </div>
      )}

      {showPronunciation && (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b px-3 py-4 sm:px-4`}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Pronunciation Guide</h3>
              <button onClick={() => setShowPronunciation(false)} aria-label="Close pronunciation guide"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pronunciationTerms.map((term) => (
                <div key={term.id} className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-lg border p-3`}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold">{term.term}</span>
                    {term.phonetic && <span className={`font-mono text-xs ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{term.phonetic}</span>}
                  </div>
                  {term.deliveryNote && <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{term.deliveryNote}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHints && (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b px-3 py-4 sm:px-4`}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Hint Ladders</h3>
              <button onClick={() => setShowHints(false)} aria-label="Close hint ladders"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {roomHintLadders.map((ladder) => (
                <button
                  key={ladder.id}
                  onClick={() => setSelectedHintLadderId(ladder.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${selectedHintLadder?.id === ladder.id ? btnActive : btnBase}`}
                >
                  {ladder.puzzleLabel}
                </button>
              ))}
            </div>
            {selectedHintLadder ? (
              <div className="space-y-2">
                <p className={`mb-3 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}><strong>Trigger:</strong> {selectedHintLadder.triggerCondition}</p>
                {[...selectedHintLadder.hints].sort((a, b) => a.level - b.level).map((hint) => (
                  <div key={hint.level} className={`flex items-start gap-3 rounded-lg border p-3 ${spoilerColors[hint.spoilerLevel]}`}>
                    <span className="mt-0.5 flex-shrink-0 text-xs font-bold">L{hint.level}</span>
                    <span className="flex-1 text-sm leading-relaxed">{hint.text}</span>
                    <span className="ml-auto flex-shrink-0 text-xs capitalize opacity-70">{hint.spoilerLevel}</span>
                  </div>
                ))}
                {selectedHintLadder.notes && <p className={`mt-2 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{selectedHintLadder.notes}</p>}
              </div>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No hint ladder is available for this room.</p>
            )}
          </div>
        </div>
      )}

      <div className={`${teleprompterMode ? 'max-w-5xl' : 'max-w-4xl'} mx-auto px-4 py-7 sm:px-6 sm:py-10`}>
        {currentVersion && currentScript && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-700/50 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-300">
              <ChevronDown className="h-3 w-3" /> Current · v{currentVersion.versionNumber}
            </span>
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{currentScript.title}</span>
            {currentVersion.toneNotes && <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Tone: {currentVersion.toneNotes}</span>}
          </div>
        )}

        {!currentVersion && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-700/50 bg-amber-900/30 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">No current approved version</p>
              <p className="mt-0.5 text-xs text-amber-400/70">GM Mode only displays approved current operating scripts. Draft, in-review, rejected, and archived versions are hidden from live delivery.</p>
            </div>
          </div>
        )}

        {currentVersion && (
          <div
            className="gm-script-reader text-xl leading-relaxed sm:text-2xl"
            style={{ fontSize: teleprompterMode ? `${fontSize}px` : undefined, lineHeight: teleprompterMode ? lineHeight : undefined }}
          >
            <SafeMarkdown text={currentVersion.bodyMarkdown} />
          </div>
        )}

        {currentVersion && currentVersion.requiredBlocks.length > 0 && (
          <div className={`mt-10 border-t pt-6 ${border}`}>
            <p className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}><ShieldCheck className="h-3.5 w-3.5" /> Required Blocks in This Script</p>
            <div className="flex flex-wrap gap-2">
              {currentVersion.requiredBlocks.map((block) => (
                <span key={block} className={`rounded border px-2 py-1 text-xs ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>{block}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {room && currentScript && currentVersion && (
        <footer className={`fixed bottom-0 left-0 right-0 z-20 border-t ${border} ${controlBg} px-3 py-2`}>
          <div className={`mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <span><strong>Room:</strong> {room.name}</span>
            <span><strong>Script:</strong> {currentScript.title}</span>
            <span><strong>Version:</strong> {currentVersion.versionNumber}</span>
            <span><strong>Approved:</strong> {formatDate(currentVersion.approvedAt)}</span>
            <span><strong>By:</strong> {currentVersion.approvedBy || 'Unknown'}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
