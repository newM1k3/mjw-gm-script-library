import { AppState, Room, ScriptReadinessResult } from '../types';
import { runAudit } from '../lib/scriptAudit';

export function exportRoomJSON(state: AppState, roomId: string): string {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return '{}';

  const scripts = state.scripts.filter((s) => s.roomId === roomId);
  const scriptIds = scripts.map((s) => s.id);
  const scriptVersions = state.scriptVersions.filter((v) => scriptIds.includes(v.scriptId));
  const hintLadders = state.hintLadders.filter((h) => h.roomId === roomId);
  const pronunciationGuide = state.pronunciationTerms.filter((t) => t.roomId === roomId);
  const acknowledgements = state.acknowledgements.filter((a) => scriptIds.includes(a.scriptId));
  const auditResult: ScriptReadinessResult = runAudit(state, room);

  const scriptsWithCurrentVersion = scripts.map((script) => ({
    ...script,
    currentVersion: scriptVersions.find((v) => v.id === script.currentVersionId) ?? null,
  }));

  const payload = {
    version: '1.0',
    sourceApp: 'GM Script Library',
    exportedAt: new Date().toISOString(),
    room,
    scripts: scriptsWithCurrentVersion,
    scriptVersions,
    hintLadders,
    pronunciationGuide,
    acknowledgements: acknowledgements.map((a) => {
      const staff = state.staffMembers.find((s) => s.id === a.staffId);
      return { ...a, staffName: staff?.name ?? 'Unknown', staffRole: staff?.role ?? 'Unknown' };
    }),
    scriptReadinessAudit: auditResult,
    integrationHints: {
      recommendedDestinations: [
        'RoomReady Ops',
        'Puzzle Flow Visualizer',
        'Puzzle Dependency Auditor',
        'LockMap Studio',
        'Room Layout Risk Mapper',
        'MJW Operator Toolkit',
      ],
      roomReadyOpsUse: 'Convert current-script acknowledgement status into pre-shift readiness tasks. Flag any staff with outstanding acknowledgements as a pre-game blocker.',
      puzzleFlowUse: 'Associate hint ladders with puzzle flow stages. Import stage labels from Puzzle Flow Visualizer to auto-scaffold hint ladder entries.',
      puzzleDependencyAuditorUse: 'Use dependency audit results to identify high-risk progression nodes and auto-suggest hint ladder coverage.',
      lockMapStudioUse: 'Import ambiguous lock and answer notes as GM hint annotations to reduce over-hinting on unclear locks.',
      roomLayoutRiskMapperUse: 'Create GM watch prompts for physical bottleneck zones and sightline risk areas identified in layout audits.',
      mjwOperatorToolkitUse: 'Bundle with RoomReady Ops for a unified pre-shift readiness and script consistency dashboard.',
      futurePocketBaseIntegration: 'Production persistence via PocketBase at VITE_POCKETBASE_URL. Collections: gms_rooms, gms_scripts, gms_script_versions, gms_hint_ladders, gms_pronunciation_terms, gms_acknowledgements.',
      futureNetlifyFunctionAI: 'AI-assisted script rewriting via Netlify serverless function. Rewrites tone without altering required safety or policy blocks. Requires ANTHROPIC_API_KEY on server side only.',
    },
  };

  return JSON.stringify(payload, null, 2);
}

export function exportRoomMarkdown(state: AppState, roomId: string): string {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return '# Room not found';

  const scripts = state.scripts.filter((s) => s.roomId === roomId);
  const hintLadders = state.hintLadders.filter((h) => h.roomId === roomId);
  const pronunciationTerms = state.pronunciationTerms.filter((t) => t.roomId === roomId);
  const auditResult = runAudit(state, room);
  const lines: string[] = [];

  lines.push(`# GM Script Library — Room Script Packet`);
  lines.push(`**Room:** ${room.name}`);
  lines.push(`**Theme:** ${room.theme}`);
  lines.push(`**Duration:** ${room.durationMinutes} minutes`);
  lines.push(`**Difficulty:** ${room.difficulty}`);
  lines.push(`**Status:** ${room.status}`);
  lines.push(`**Exported:** ${new Date().toLocaleDateString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## Script Readiness Score: ${auditResult.score}/100`);
  lines.push('');

  if (auditResult.issues.length === 0) {
    lines.push('All checks passed. This room is ready for GM delivery.');
  } else {
    lines.push(`**Issues:** ${auditResult.criticalCount} critical · ${auditResult.warningCount} warnings · ${auditResult.improvementCount} improvements`);
    lines.push('');
    lines.push('### Unresolved Issues');
    for (const issue of auditResult.issues) {
      const icon = issue.severity === 'critical' ? '[CRITICAL]' : issue.severity === 'warning' ? '[WARNING]' : '[IMPROVEMENT]';
      lines.push(`- ${icon} ${issue.description}`);
      lines.push(`  *Fix:* ${issue.recommendation}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  if (room.notes) {
    lines.push('## Room Notes');
    lines.push(room.notes);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const scriptTypeOrder = ['safety_brief','pre_game_brief','story_intro','character_intro','mid_game_intervention','hint_ladder','post_game_debrief','reset_note','training_note'] as const;
  const scriptTypeLabels: Record<string, string> = {
    safety_brief: 'Safety Briefing', pre_game_brief: 'Pre-Game Briefing', story_intro: 'Story Introduction',
    character_intro: 'Character Introduction', mid_game_intervention: 'Mid-Game Intervention',
    hint_ladder: 'Hint Ladder Script', post_game_debrief: 'Post-Game Debrief',
    reset_note: 'Reset Notes', training_note: 'Training Notes',
  };

  lines.push('## Scripts');
  lines.push('');

  for (const scriptType of scriptTypeOrder) {
    const typeScripts = scripts.filter((s) => s.scriptType === scriptType);
    if (typeScripts.length === 0) continue;
    lines.push(`### ${scriptTypeLabels[scriptType] ?? scriptType}`);
    lines.push('');
    for (const script of typeScripts) {
      const currentVersion = state.scriptVersions.find((v) => v.id === script.currentVersionId);
      lines.push(`#### ${script.title}`);
      if (script.tags.length > 0) lines.push(`*Tags: ${script.tags.join(', ')}*`);
      lines.push('');
      if (currentVersion) {
        lines.push(`**Version:** ${currentVersion.versionNumber} | **Approved:** ${currentVersion.approvedAt ? new Date(currentVersion.approvedAt).toLocaleDateString() : 'N/A'} | **By:** ${currentVersion.approvedBy || 'N/A'}`);
        if (currentVersion.toneNotes) lines.push(`**Tone Notes:** ${currentVersion.toneNotes}`);
        if (currentVersion.requiredBlocks.length > 0) lines.push(`**Required Blocks:** ${currentVersion.requiredBlocks.join(', ')}`);
        lines.push('');
        lines.push(currentVersion.bodyMarkdown);
      } else {
        lines.push('*No current approved version.*');
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  if (hintLadders.length > 0) {
    lines.push('## Hint Ladders');
    lines.push('');
    for (const ladder of hintLadders) {
      lines.push(`### ${ladder.puzzleLabel}`);
      lines.push(`**Stage:** ${ladder.stageLabel}`);
      lines.push(`**Trigger:** ${ladder.triggerCondition}`);
      if (ladder.notes) lines.push(`**Notes:** ${ladder.notes}`);
      lines.push('');
      for (const hint of ladder.hints.sort((a, b) => a.level - b.level)) {
        lines.push(`**Level ${hint.level}** [${hint.spoilerLevel.toUpperCase()} SPOILER]`);
        lines.push(`> ${hint.text}`);
        lines.push('');
      }
    }
    lines.push('---');
    lines.push('');
  }

  if (pronunciationTerms.length > 0) {
    lines.push('## Pronunciation Guide');
    lines.push('');
    for (const term of pronunciationTerms) {
      lines.push(`### ${term.term}`);
      if (term.phonetic) lines.push(`**Phonetic:** ${term.phonetic}`);
      if (term.meaning) lines.push(`**Meaning:** ${term.meaning}`);
      if (term.context) lines.push(`**Context:** ${term.context}`);
      if (term.deliveryNote) lines.push(`**Delivery Note:** ${term.deliveryNote}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  lines.push('## Staff Acknowledgement Summary');
  lines.push('');
  const currentScripts = scripts.filter((s) => s.currentVersionId);
  for (const staff of state.staffMembers.filter((s) => s.active)) {
    lines.push(`### ${staff.name} (${staff.role})`);
    for (const script of currentScripts) {
      const ack = state.acknowledgements.find(
        (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId
      );
      const status = ack ? `Acknowledged ${new Date(ack.acknowledgedAt).toLocaleDateString()}` : 'NOT ACKNOWLEDGED';
      lines.push(`- **${script.title}:** ${status}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Change History');
  lines.push('');
  for (const script of scripts) {
    const versions = state.scriptVersions
      .filter((v) => v.scriptId === script.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (versions.length > 0) {
      lines.push(`### ${script.title}`);
      for (const version of versions) {
        const isCurrent = version.id === script.currentVersionId;
        lines.push(`- **v${version.versionNumber}**${isCurrent ? ' *(current)*' : ''} — ${new Date(version.createdAt).toLocaleDateString()} — ${version.changeSummary}`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by GM Script Library · MJW Personal App Platform*');
  lines.push('');
  lines.push('**Future Integration Note:** This packet can be imported into RoomReady Ops for pre-shift acknowledgement tasks, and into Puzzle Flow Visualizer for stage-based hint ladder alignment.');

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
