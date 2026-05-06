import { useState, useEffect } from 'react';
import { Save, Plus, Tag, X, Info } from 'lucide-react';
import { AppState, Script, ScriptVersion, ScriptType, ScriptStatus } from '../types';

interface Props {
  state: AppState;
  editingScriptId: string | null;
  onSaveScript: (script: Script) => void;
  onSaveVersion: (version: ScriptVersion) => void;
  onSetCurrentVersion: (scriptId: string, versionId: string) => void;
}

const scriptTypeOptions: { value: ScriptType; label: string }[] = [
  { value: 'pre_game_brief', label: 'Pre-Game Briefing' },
  { value: 'safety_brief', label: 'Safety Briefing' },
  { value: 'story_intro', label: 'Story Introduction' },
  { value: 'character_intro', label: 'Character Introduction' },
  { value: 'hint_ladder', label: 'Hint Ladder Script' },
  { value: 'mid_game_intervention', label: 'Mid-Game Intervention' },
  { value: 'post_game_debrief', label: 'Post-Game Debrief' },
  { value: 'reset_note', label: 'Reset Note' },
  { value: 'training_note', label: 'Training Note' },
];

export default function ScriptEditor({ state, editingScriptId, onSaveScript, onSaveVersion, onSetCurrentVersion }: Props) {
  const existingScript = editingScriptId ? state.scripts.find((s) => s.id === editingScriptId) ?? null : null;

  const [scriptForm, setScriptForm] = useState({
    roomId: existingScript?.roomId ?? (state.rooms[0]?.id ?? ''),
    title: existingScript?.title ?? '',
    scriptType: (existingScript?.scriptType ?? 'pre_game_brief') as ScriptType,
    audience: existingScript?.audience ?? 'players',
    tags: existingScript?.tags ?? ([] as string[]),
  });
  const [tagInput, setTagInput] = useState('');

  const latestVersion = existingScript
    ? state.scriptVersions.filter((v) => v.scriptId === existingScript.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    : null;

  const [versionForm, setVersionForm] = useState({
    bodyMarkdown: latestVersion?.bodyMarkdown ?? '',
    toneNotes: latestVersion?.toneNotes ?? '',
    changeSummary: '',
    versionNumber: '',
    requiredBlocksRaw: latestVersion?.requiredBlocks.join(', ') ?? '',
    optionalBlocksRaw: latestVersion?.optionalBlocks.join(', ') ?? '',
    approvedBy: '',
    makeCurrentOnSave: false,
  });

  useEffect(() => {
    if (existingScript) {
      setScriptForm({ roomId: existingScript.roomId, title: existingScript.title, scriptType: existingScript.scriptType, audience: existingScript.audience, tags: existingScript.tags });
    }
  }, [editingScriptId]);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !scriptForm.tags.includes(t)) setScriptForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  }

  function removeTag(tag: string) { setScriptForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) })); }

  function suggestVersionNumber() {
    if (!existingScript) return '1.0';
    const versions = state.scriptVersions.filter((v) => v.scriptId === existingScript.id);
    if (versions.length === 0) return '1.0';
    const latest = versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const parts = latest.versionNumber.split('.');
    return `${parts[0]}.${parseInt(parts[1] ?? '0') + 1}`;
  }

  function handleSave() {
    const now = new Date().toISOString();
    let script: Script;
    if (existingScript) {
      script = { ...existingScript, ...scriptForm, status: (existingScript.status === 'archived' ? 'archived' : 'draft') as ScriptStatus, updatedAt: now };
    } else {
      script = { id: `script_${Date.now()}`, ...scriptForm, status: 'draft', currentVersionId: null, createdAt: now, updatedAt: now };
    }
    onSaveScript(script);
    if (versionForm.bodyMarkdown.trim()) {
      const vn = versionForm.versionNumber.trim() || suggestVersionNumber();
      const version: ScriptVersion = {
        id: `ver_${Date.now()}`,
        scriptId: script.id,
        versionNumber: vn,
        bodyMarkdown: versionForm.bodyMarkdown,
        requiredBlocks: versionForm.requiredBlocksRaw.split(',').map((s) => s.trim()).filter(Boolean),
        optionalBlocks: versionForm.optionalBlocksRaw.split(',').map((s) => s.trim()).filter(Boolean),
        toneNotes: versionForm.toneNotes,
        changeSummary: versionForm.changeSummary || 'New version.',
        approvalStatus: versionForm.makeCurrentOnSave ? 'approved' : 'draft',
        approvedBy: versionForm.approvedBy,
        approvedAt: versionForm.makeCurrentOnSave ? now : null,
        createdAt: now,
      };
      onSaveVersion(version);
      if (versionForm.makeCurrentOnSave) onSetCurrentVersion(script.id, version.id);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{existingScript ? `Edit: ${existingScript.title}` : 'New Script'}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{existingScript ? 'Update script metadata or create a new version.' : 'Define a new script family for a room.'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Script Details</h2>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Room</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" value={scriptForm.roomId} onChange={(e) => setScriptForm((f) => ({ ...f, roomId: e.target.value }))}>
                {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                {state.rooms.length === 0 && <option value="">No rooms — create one first</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Clockmaker Pre-Game Briefing" value={scriptForm.title} onChange={(e) => setScriptForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Script Type</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" value={scriptForm.scriptType} onChange={(e) => setScriptForm((f) => ({ ...f, scriptType: e.target.value as ScriptType }))}>
                {scriptTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Audience</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="players, staff, managers" value={scriptForm.audience} onChange={(e) => setScriptForm((f) => ({ ...f, audience: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tags</label>
              <div className="flex gap-2">
                <input className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Add tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                <button onClick={addTag} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600 transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
              {scriptForm.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {scriptForm.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-700 border border-slate-600 rounded-full text-slate-300">
                      <Tag className="w-3 h-3" /> {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">New Version Content</h2>
              {existingScript && latestVersion && <span className="text-xs text-slate-500">Based on v{latestVersion.versionNumber}</span>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Script Body <span className="text-slate-500">(Markdown supported)</span></label>
              <textarea rows={14} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none font-mono" placeholder="## Script Title&#10;&#10;Write your script content here..." value={versionForm.bodyMarkdown} onChange={(e) => setVersionForm((f) => ({ ...f, bodyMarkdown: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tone Notes</label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Warm, mysterious, slightly urgent" value={versionForm.toneNotes} onChange={(e) => setVersionForm((f) => ({ ...f, toneNotes: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Version Number</label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder={suggestVersionNumber()} value={versionForm.versionNumber} onChange={(e) => setVersionForm((f) => ({ ...f, versionNumber: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Required Blocks <span className="text-slate-500">(comma-separated)</span></label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="safety, time_limit, hint_policy" value={versionForm.requiredBlocksRaw} onChange={(e) => setVersionForm((f) => ({ ...f, requiredBlocksRaw: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Optional Blocks <span className="text-slate-500">(comma-separated)</span></label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="birthday_greeting, first_time_players" value={versionForm.optionalBlocksRaw} onChange={(e) => setVersionForm((f) => ({ ...f, optionalBlocksRaw: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Change Summary</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="Briefly describe what changed in this version..." value={versionForm.changeSummary} onChange={(e) => setVersionForm((f) => ({ ...f, changeSummary: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Approved By</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Manager, Owner" value={versionForm.approvedBy} onChange={(e) => setVersionForm((f) => ({ ...f, approvedBy: e.target.value }))} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800" checked={versionForm.makeCurrentOnSave} onChange={(e) => setVersionForm((f) => ({ ...f, makeCurrentOnSave: e.target.checked }))} />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">Mark as current approved version on save</span>
            </label>
            <div className="flex items-start gap-2 p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-xs text-blue-300/80">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
              <span>If no version content is entered, only the script metadata will be saved.</span>
            </div>
          </div>
          <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Save className="w-4 h-4" /> {existingScript ? 'Save Changes' : 'Create Script'}
          </button>
        </div>
      </div>
    </div>
  );
}
