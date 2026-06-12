import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, GitCompare, Info, Loader2, Plus, Save, Sparkles, Tag, X } from 'lucide-react';
import { AppState, Script, ScriptVersion, ScriptType, ScriptStatus } from '../types';
import { AuthUser, canManageData, displayNameForAuthUser } from '../lib/auth';
import { useToast } from '../lib/useToast';
import {
  AIRewriteDraftPreview,
  AIRewriteResponsePayload,
  AIRewriteSettings,
  buildAIRewriteDraftPreview,
  buildAIRewriteRequest,
  defaultAIRewriteSettings,
  splitBlockList,
  summarizeAIRewriteWarnings,
} from '../lib/aiRewrite';

interface Props {
  state: AppState;
  editingScriptId: string | null;
  onSaveScript: (script: Script) => void;
  onSaveVersion: (version: ScriptVersion) => void;
  currentUser: AuthUser | null;
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

const toneOptions: { value: AIRewriteSettings['tone']; label: string }[] = [
  { value: 'warmer', label: 'Warmer' },
  { value: 'more_mysterious', label: 'More mysterious' },
  { value: 'more_direct', label: 'More direct' },
  { value: 'more_theatrical', label: 'More theatrical' },
  { value: 'more_calm', label: 'More calm' },
];

const clarityOptions: { value: AIRewriteSettings['clarity']; label: string }[] = [
  { value: 'light', label: 'Light cleanup' },
  { value: 'standard', label: 'Standard clarity pass' },
  { value: 'high', label: 'High clarity / simplify' },
];

const lengthOptions: { value: AIRewriteSettings['length']; label: string }[] = [
  { value: 'shorter', label: 'Shorter' },
  { value: 'same_length', label: 'Same length' },
  { value: 'longer', label: 'Longer' },
];

const readingLevelOptions: { value: AIRewriteSettings['readingLevel']; label: string }[] = [
  { value: 'plain_language', label: 'Plain language' },
  { value: 'grade_6_8', label: 'Grade 6–8' },
  { value: 'grade_9_10', label: 'Grade 9–10' },
  { value: 'staff_technical', label: 'Staff technical' },
];

function diffClass(status: string) {
  if (status === 'added') return 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200';
  if (status === 'removed') return 'border-red-700/50 bg-red-950/20 text-red-200';
  if (status === 'changed') return 'border-amber-700/50 bg-amber-950/20 text-amber-100';
  return 'border-slate-800 bg-slate-950/30 text-slate-400';
}

export default function ScriptEditor({ state, editingScriptId, currentUser, onSaveScript, onSaveVersion }: Props) {
  const { toast } = useToast();
  const existingScript = editingScriptId ? state.scripts.find((s) => s.id === editingScriptId) ?? null : null;
  const canUseAIRewrite = canManageData(currentUser);

  const [scriptForm, setScriptForm] = useState({
    roomId: existingScript?.roomId ?? (state.rooms[0]?.id ?? ''),
    title: existingScript?.title ?? '',
    scriptType: (existingScript?.scriptType ?? 'pre_game_brief') as ScriptType,
    audience: existingScript?.audience ?? 'players',
    tags: existingScript?.tags ?? ([] as string[]),
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const latestVersion = useMemo(() => existingScript
    ? state.scriptVersions.filter((v) => v.scriptId === existingScript.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    : null, [existingScript, state.scriptVersions]);

  const [versionForm, setVersionForm] = useState({
    bodyMarkdown: latestVersion?.bodyMarkdown ?? '',
    toneNotes: latestVersion?.toneNotes ?? '',
    changeSummary: '',
    versionNumber: '',
    requiredBlocksRaw: latestVersion?.requiredBlocks.join(', ') ?? '',
    optionalBlocksRaw: latestVersion?.optionalBlocks.join(', ') ?? '',
    submitForReview: true,
  });

  const [rewriteSettings, setRewriteSettings] = useState<AIRewriteSettings>({ ...defaultAIRewriteSettings, audience: scriptForm.audience || defaultAIRewriteSettings.audience });
  const [rewritePreview, setRewritePreview] = useState<AIRewriteDraftPreview | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);

  useEffect(() => {
    if (existingScript) {
      setScriptForm({ roomId: existingScript.roomId, title: existingScript.title, scriptType: existingScript.scriptType, audience: existingScript.audience, tags: existingScript.tags });
    }
  }, [existingScript]);

  useEffect(() => {
    setVersionForm((form) => ({
      ...form,
      bodyMarkdown: latestVersion?.bodyMarkdown ?? form.bodyMarkdown,
      toneNotes: latestVersion?.toneNotes ?? form.toneNotes,
      requiredBlocksRaw: latestVersion?.requiredBlocks.join(', ') ?? form.requiredBlocksRaw,
      optionalBlocksRaw: latestVersion?.optionalBlocks.join(', ') ?? form.optionalBlocksRaw,
    }));
  }, [latestVersion]);

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

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!scriptForm.title.trim()) e.title = 'Script title is required.';
    if (!scriptForm.roomId) e.roomId = 'A room must be selected.';
    if (versionForm.bodyMarkdown.trim() && !versionForm.changeSummary.trim()) e.changeSummary = 'A change summary is required for every new version.';
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});

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
        requiredBlocks: splitBlockList(versionForm.requiredBlocksRaw),
        optionalBlocks: splitBlockList(versionForm.optionalBlocksRaw),
        toneNotes: versionForm.toneNotes,
        changeSummary: versionForm.changeSummary.trim(),
        approvalStatus: versionForm.submitForReview ? 'in_review' : 'draft',
        approvedBy: '',
        approvedAt: null,
        createdAt: now,
        createdBy: currentUser?.staffMemberId,
        submittedBy: versionForm.submitForReview ? currentUser?.staffMemberId : undefined,
        previousVersionId: latestVersion?.id ?? null,
      };
      onSaveVersion(version);
      toast(existingScript ? `"${script.title}" updated with v${vn} (${version.approvalStatus.replace('_', ' ')})` : `"${script.title}" created with v${vn} (${version.approvalStatus.replace('_', ' ')})`);
    } else {
      toast(existingScript ? `"${script.title}" metadata saved` : `"${script.title}" created`);
    }
  }

  async function handleRequestAIRewrite() {
    if (!existingScript) {
      setRewriteError('Save the script before requesting an AI rewrite so the draft can be attached to the correct script family.');
      return;
    }
    if (!canUseAIRewrite) {
      setRewriteError('Only managers and admins can request AI-assisted rewrites.');
      return;
    }
    if (!versionForm.bodyMarkdown.trim()) {
      setRewriteError('Add or load script body content before requesting a rewrite.');
      return;
    }

    setIsRewriting(true);
    setRewriteError(null);
    setRewritePreview(null);
    try {
      const requiredBlocks = splitBlockList(versionForm.requiredBlocksRaw);
      const optionalBlocks = splitBlockList(versionForm.optionalBlocksRaw);
      const payload = buildAIRewriteRequest(
        existingScript,
        latestVersion,
        versionForm.bodyMarkdown,
        versionForm.toneNotes,
        requiredBlocks,
        optionalBlocks,
        { ...rewriteSettings, audience: rewriteSettings.audience || scriptForm.audience || 'players' }
      );
      const response = await fetch('/.netlify/functions/rewrite-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI rewrite failed.');
      const preview = buildAIRewriteDraftPreview(latestVersion, data as AIRewriteResponsePayload, requiredBlocks);
      preview.warnings = summarizeAIRewriteWarnings(preview.requiredBlockCheck, preview.warnings);
      setRewritePreview(preview);
      toast('AI rewrite generated as a preview. Review the diff before saving a draft.');
    } catch (error) {
      setRewriteError(error instanceof Error ? error.message : 'Unable to generate an AI rewrite.');
    } finally {
      setIsRewriting(false);
    }
  }

  function handleSaveAIRewriteDraft() {
    if (!existingScript || !rewritePreview) return;
    if (!rewritePreview.requiredBlockCheck.preserved) {
      setRewriteError('The AI rewrite changed or removed required blocks. It cannot be saved until the server returns a preserved-block draft.');
      return;
    }
    const now = new Date().toISOString();
    const vn = versionForm.versionNumber.trim() || suggestVersionNumber();
    const requiredBlocks = splitBlockList(versionForm.requiredBlocksRaw);
    const optionalBlocks = splitBlockList(versionForm.optionalBlocksRaw);
    const version: ScriptVersion = {
      id: `ver_ai_${Date.now()}`,
      scriptId: existingScript.id,
      versionNumber: vn,
      bodyMarkdown: rewritePreview.bodyMarkdown,
      requiredBlocks,
      optionalBlocks,
      toneNotes: versionForm.toneNotes,
      changeSummary: `AI-assisted rewrite draft for ${rewriteSettings.tone}, ${rewriteSettings.clarity}, ${rewriteSettings.length}, ${rewriteSettings.readingLevel}.`,
      approvalStatus: 'draft',
      approvedBy: '',
      approvedAt: null,
      createdAt: now,
      createdBy: currentUser?.staffMemberId,
      previousVersionId: latestVersion?.id ?? null,
      aiRewrite: {
        assisted: true,
        provider: rewritePreview.provider,
        model: rewritePreview.model,
        generatedAt: rewritePreview.generatedAt,
        sourceVersionId: latestVersion?.id ?? null,
        settings: rewriteSettings,
        requiredBlockCheck: rewritePreview.requiredBlockCheck,
        warnings: rewritePreview.warnings,
      },
    };
    onSaveVersion(version);
    setRewritePreview(null);
    toast(`AI rewrite saved as draft v${vn}. It must be submitted, reviewed, and approved before it can become current.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{existingScript ? `Edit: ${existingScript.title}` : 'New Script'}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{existingScript ? 'Update script metadata or create a new version.' : 'Define a new script family for a room.'}</p>
      </div>

      {state.rooms.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">No rooms exist yet. Go to Room Setup and create a room first before adding scripts.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Script Details</h2>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Room *</label>
              <select className={`w-full bg-slate-700 border ${errors.roomId ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500`} value={scriptForm.roomId} onChange={(e) => setScriptForm((f) => ({ ...f, roomId: e.target.value }))}>
                {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                {state.rooms.length === 0 && <option value="">No rooms — create one first</option>}
              </select>
              {errors.roomId && <p className="text-xs text-red-400 mt-1">{errors.roomId}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title *</label>
              <input className={`w-full bg-slate-700 border ${errors.title ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="e.g. Clockmaker Pre-Game Briefing" value={scriptForm.title} onChange={(e) => setScriptForm((f) => ({ ...f, title: e.target.value }))} />
              {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
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
                <button onClick={addTag} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600 transition-colors" aria-label="Add tag"><Plus className="w-4 h-4" /></button>
              </div>
              {scriptForm.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {scriptForm.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-700 border border-slate-600 rounded-full text-slate-300">
                      <Tag className="w-3 h-3" /> {tag}
                      <button onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`} className="hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
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
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Tone Notes</label><input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="e.g. Warm, mysterious, slightly urgent" value={versionForm.toneNotes} onChange={(e) => setVersionForm((f) => ({ ...f, toneNotes: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Version Number</label><input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder={suggestVersionNumber()} value={versionForm.versionNumber} onChange={(e) => setVersionForm((f) => ({ ...f, versionNumber: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Required Blocks <span className="text-slate-500">(comma-separated)</span></label><input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="safety, time_limit, hint_policy" value={versionForm.requiredBlocksRaw} onChange={(e) => setVersionForm((f) => ({ ...f, requiredBlocksRaw: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Optional Blocks <span className="text-slate-500">(comma-separated)</span></label><input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" placeholder="birthday_greeting, first_time_players" value={versionForm.optionalBlocksRaw} onChange={(e) => setVersionForm((f) => ({ ...f, optionalBlocksRaw: e.target.value }))} /></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Change Summary *</label>
              <input className={`w-full bg-slate-700 border ${errors.changeSummary ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500`} placeholder="Briefly describe what changed in this version..." value={versionForm.changeSummary} onChange={(e) => setVersionForm((f) => ({ ...f, changeSummary: e.target.value }))} />
              {errors.changeSummary && <p className="text-xs text-red-400 mt-1">{errors.changeSummary}</p>}
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
              Creator identity: <span className="text-slate-200">{displayNameForAuthUser(currentUser)}</span>. New versions are saved as drafts or submitted for review; approval and publishing happen from Version History.
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800" checked={versionForm.submitForReview} onChange={(e) => setVersionForm((f) => ({ ...f, submitForReview: e.target.checked }))} />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">Submit this version for manager review on save</span>
            </label>
            <div className="flex items-start gap-2 p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-xs text-blue-300/80">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
              <span>If no version content is entered, only the script metadata will be saved.</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-purple-700/40 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-200 uppercase tracking-wider"><Sparkles className="w-4 h-4" /> AI-Assisted Rewrite</h2>
                <p className="text-xs text-slate-400 mt-1">AI runs through a server-side function only. Generated text can be saved only as a draft and must pass the normal review and approval workflow before becoming current.</p>
              </div>
              {!canUseAIRewrite && <span className="text-xs px-2 py-1 rounded-full bg-amber-950/40 text-amber-300 border border-amber-800/50">Manager/admin only</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Tone</label><select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100" value={rewriteSettings.tone} onChange={(e) => setRewriteSettings((s) => ({ ...s, tone: e.target.value as AIRewriteSettings['tone'] }))}>{toneOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Clarity</label><select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100" value={rewriteSettings.clarity} onChange={(e) => setRewriteSettings((s) => ({ ...s, clarity: e.target.value as AIRewriteSettings['clarity'] }))}>{clarityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Length</label><select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100" value={rewriteSettings.length} onChange={(e) => setRewriteSettings((s) => ({ ...s, length: e.target.value as AIRewriteSettings['length'] }))}>{lengthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Audience</label><input className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100" value={rewriteSettings.audience} onChange={(e) => setRewriteSettings((s) => ({ ...s, audience: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Reading Level</label><select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100" value={rewriteSettings.readingLevel} onChange={(e) => setRewriteSettings((s) => ({ ...s, readingLevel: e.target.value as AIRewriteSettings['readingLevel'] }))}>{readingLevelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            <button onClick={handleRequestAIRewrite} disabled={!canUseAIRewrite || !existingScript || isRewriting} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
              {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Request Safe Rewrite
            </button>
            {rewriteError && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-xs text-red-200"><AlertCircle className="w-4 h-4 flex-shrink-0" />{rewriteError}</div>}
            {rewritePreview && (
              <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><GitCompare className="w-4 h-4" /> Before / After Diff</h3>
                    <p className="text-xs text-slate-500">Provider: {rewritePreview.provider} · Model: {rewritePreview.model} · Generated: {new Date(rewritePreview.generatedAt).toLocaleString()}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${rewritePreview.requiredBlockCheck.preserved ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/50' : 'bg-red-950/30 text-red-300 border-red-800/50'}`}>
                    {rewritePreview.requiredBlockCheck.preserved ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {rewritePreview.requiredBlockCheck.preserved ? 'Required blocks preserved' : 'Required block issue'}
                  </span>
                </div>
                {rewritePreview.warnings.length > 0 && <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-200">{rewritePreview.warnings.join(' ')}</div>}
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-800">
                  {rewritePreview.diff.map((line) => (
                    <div key={line.lineNumber} className={`grid grid-cols-[3rem_1fr_1fr] gap-2 border-b px-2 py-1 text-xs font-mono ${diffClass(line.status)}`}>
                      <span className="text-slate-500">{line.lineNumber}</span>
                      <span className="whitespace-pre-wrap">{line.currentText}</span>
                      <span className="whitespace-pre-wrap">{line.candidateText}</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleSaveAIRewriteDraft} disabled={!rewritePreview.requiredBlockCheck.preserved} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                  <Save className="w-4 h-4" /> Save AI Output as Draft Version
                </button>
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={state.rooms.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
            <Save className="w-4 h-4" /> {existingScript ? 'Save Changes' : 'Create Script'}
          </button>
        </div>
      </div>
    </div>
  );
}
