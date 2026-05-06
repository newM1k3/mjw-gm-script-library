import { useState } from 'react';
import { BookOpen, ChevronDown, Volume2, Layers, AlertTriangle, Moon, Sun, X } from 'lucide-react';
import { AppState, ScriptType } from '../types';

interface Props {
  state: AppState;
}

const scriptTypeLabels: Record<ScriptType, string> = {
  pre_game_brief: 'Pre-Game Brief', safety_brief: 'Safety Brief', story_intro: 'Story Intro',
  character_intro: 'Character Intro', hint_ladder: 'Hint Ladder', mid_game_intervention: 'Mid-Game Intervention',
  post_game_debrief: 'Post-Game Debrief', reset_note: 'Reset Note', training_note: 'Training Note',
};

const scriptTypeOrder: ScriptType[] = [
  'safety_brief','pre_game_brief','story_intro','character_intro','mid_game_intervention',
  'hint_ladder','post_game_debrief','reset_note','training_note',
];

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-6 mb-2 text-current">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-6 mb-3 text-current">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-4 mb-4 text-current">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic opacity-80">$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-current border-opacity-30 pl-4 my-3 italic opacity-70">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc my-1">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal my-1">$2</li>')
    .replace(/`(.+?)`/g, '<code class="font-mono bg-black bg-opacity-20 px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/\n\n/g, '</p><p class="my-3">')
    .replace(/\n/g, '<br/>');
}

export default function GMModeReader({ state }: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState(state.rooms[0]?.id ?? '');
  const [selectedType, setSelectedType] = useState<ScriptType>('pre_game_brief');
  const [darkMode, setDarkMode] = useState(true);
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [selectedHintLadderId, setSelectedHintLadderId] = useState('');

  const room = state.rooms.find((r) => r.id === selectedRoomId);
  const roomScripts = state.scripts.filter((s) => s.roomId === selectedRoomId && s.scriptType === selectedType);
  const currentScript = roomScripts.find((s) => s.currentVersionId) ?? null;
  const currentVersion = currentScript ? state.scriptVersions.find((v) => v.id === currentScript.currentVersionId) ?? null : null;
  const pronunciationTerms = state.pronunciationTerms.filter((t) => t.roomId === selectedRoomId);
  const roomHintLadders = state.hintLadders.filter((h) => h.roomId === selectedRoomId);
  const selectedHintLadder = roomHintLadders.find((h) => h.id === selectedHintLadderId);
  const availableTypes = scriptTypeOrder.filter((type) => state.scripts.some((s) => s.roomId === selectedRoomId && s.scriptType === type));

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

  return (
    <div className={`min-h-screen ${bg} transition-colors`}>
      <div className={`sticky top-0 z-20 ${controlBg} border-b ${border} px-4 py-3`}>
        <div className="flex items-center gap-3 flex-wrap max-w-4xl mx-auto">
          <BookOpen className={`w-5 h-5 flex-shrink-0 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <span className={`text-sm font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>GM Mode</span>
          <select className={`flex-1 min-w-32 max-w-48 text-sm rounded-lg px-3 py-1.5 border ${selectCls} focus:outline-none`} value={selectedRoomId} onChange={(e) => { setSelectedRoomId(e.target.value); setSelectedType('pre_game_brief'); }}>
            {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className={`flex-1 min-w-36 max-w-52 text-sm rounded-lg px-3 py-1.5 border ${selectCls} focus:outline-none`} value={selectedType} onChange={(e) => setSelectedType(e.target.value as ScriptType)}>
            {availableTypes.map((type) => <option key={type} value={type}>{scriptTypeLabels[type]}</option>)}
          </select>
          <div className="flex items-center gap-2 ml-auto">
            {pronunciationTerms.length > 0 && (
              <button onClick={() => { setShowPronunciation(!showPronunciation); setShowHints(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${showPronunciation ? btnActive : btnBase}`}>
                <Volume2 className="w-3.5 h-3.5" /> Pronounce
              </button>
            )}
            {roomHintLadders.length > 0 && (
              <button onClick={() => { setShowHints(!showHints); setShowPronunciation(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${showHints ? btnActive : btnBase}`}>
                <Layers className="w-3.5 h-3.5" /> Hints
              </button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className={`p-1.5 rounded-lg border transition-colors ${btnBase}`}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {showPronunciation && (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b px-4 py-4`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Pronunciation Guide</h3>
              <button onClick={() => setShowPronunciation(false)}><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pronunciationTerms.map((term) => (
                <div key={term.id} className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-lg p-3`}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{term.term}</span>
                    {term.phonetic && <span className={`text-xs font-mono ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{term.phonetic}</span>}
                  </div>
                  {term.deliveryNote && <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{term.deliveryNote}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHints && (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b px-4 py-4`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Hint Ladders</h3>
              <button onClick={() => setShowHints(false)}><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {roomHintLadders.map((ladder) => (
                <button key={ladder.id} onClick={() => setSelectedHintLadderId(ladder.id)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${selectedHintLadderId === ladder.id ? btnActive : btnBase}`}>{ladder.puzzleLabel}</button>
              ))}
            </div>
            {selectedHintLadder ? (
              <div className="space-y-2">
                <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}><strong>Trigger:</strong> {selectedHintLadder.triggerCondition}</p>
                {selectedHintLadder.hints.sort((a, b) => a.level - b.level).map((hint) => (
                  <div key={hint.level} className={`flex items-start gap-3 p-3 rounded-lg border ${spoilerColors[hint.spoilerLevel]}`}>
                    <span className="text-xs font-bold flex-shrink-0 mt-0.5">L{hint.level}</span>
                    <span className="text-sm leading-relaxed flex-1">{hint.text}</span>
                    <span className="ml-auto text-xs flex-shrink-0 opacity-70 capitalize">{hint.spoilerLevel}</span>
                  </div>
                ))}
                {selectedHintLadder.notes && <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{selectedHintLadder.notes}</p>}
              </div>
            ) : (
              <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Select a puzzle above to see its hint ladder.</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {currentVersion && (
          <div className="flex items-center gap-2 mb-6">
            <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-emerald-900/40 text-emerald-300 border-emerald-700/50">
              <ChevronDown className="w-3 h-3" /> Current · v{currentVersion.versionNumber}
            </span>
            {currentVersion.toneNotes && <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tone: {currentVersion.toneNotes}</span>}
          </div>
        )}

        {!currentVersion && (
          <div className="flex items-start gap-3 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-medium text-sm">No current approved version</p>
              <p className="text-amber-400/70 text-xs mt-0.5">No script of this type has a current approved version for this room.</p>
            </div>
          </div>
        )}

        {currentVersion && (
          <div className="text-lg sm:text-xl leading-relaxed"
            dangerouslySetInnerHTML={{ __html: `<p class="my-3">${renderMarkdown(currentVersion.bodyMarkdown)}</p>` }}
          />
        )}

        {currentVersion && currentVersion.requiredBlocks.length > 0 && (
          <div className={`mt-10 pt-6 border-t ${border}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Required Blocks in This Script</p>
            <div className="flex flex-wrap gap-2">
              {currentVersion.requiredBlocks.map((block) => (
                <span key={block} className={`text-xs px-2 py-1 rounded border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>{block}</span>
              ))}
            </div>
          </div>
        )}

        {room && (
          <div className={`mt-10 pt-6 border-t ${border} text-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            {room.name} · {room.durationMinutes}m · {scriptTypeLabels[selectedType]}
          </div>
        )}
      </div>
    </div>
  );
}
