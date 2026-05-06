import { AppState, ScriptReadinessIssue, ScriptReadinessResult, Room } from '../types';

let issueCounter = 0;

function makeIssue(
  roomId: string,
  severity: ScriptReadinessIssue['severity'],
  category: string,
  description: string,
  recommendation: string
): ScriptReadinessIssue {
  return { id: `issue_${++issueCounter}`, roomId, severity, category, description, recommendation };
}

export function runAudit(state: AppState, room: Room): ScriptReadinessResult {
  issueCounter = 0;
  const issues: ScriptReadinessIssue[] = [];
  const roomScripts = state.scripts.filter((s) => s.roomId === room.id);
  const currentVersionIds = roomScripts
    .filter((s) => s.currentVersionId)
    .map((s) => s.currentVersionId as string);

  // 1. Active room missing current pre-game briefing
  if (room.status === 'active') {
    const hasPreGame = roomScripts.some(
      (s) => s.scriptType === 'pre_game_brief' && s.currentVersionId
    );
    if (!hasPreGame) {
      issues.push(
        makeIssue(
          room.id, 'critical', 'Missing Script',
          `Active room "${room.name}" has no current pre-game briefing.`,
          'Create and approve a pre_game_brief script for this room.'
        )
      );
    }
  }

  // 2. Active room missing current safety briefing
  if (room.status === 'active') {
    const hasSafety = roomScripts.some(
      (s) => s.scriptType === 'safety_brief' && s.currentVersionId
    );
    if (!hasSafety) {
      issues.push(
        makeIssue(
          room.id, 'critical', 'Missing Script',
          `Active room "${room.name}" has no current safety briefing.`,
          'Create and approve a safety_brief script for this room.'
        )
      );
    }
  }

  // 3. Active room missing hint ladder coverage
  if (room.status === 'active') {
    const roomHints = state.hintLadders.filter((h) => h.roomId === room.id);
    if (roomHints.length === 0) {
      issues.push(
        makeIssue(
          room.id, 'warning', 'Missing Hints',
          `Active room "${room.name}" has no hint ladders.`,
          'Add at least one hint ladder for each major puzzle.'
        )
      );
    }
  }

  // 4. Script family with no current approved version
  for (const script of roomScripts) {
    if (!script.currentVersionId) {
      issues.push(
        makeIssue(
          room.id, 'warning', 'No Current Version',
          `Script "${script.title}" has no current approved version.`,
          'Review drafts and approve a version, or archive the script if no longer needed.'
        )
      );
    }
  }

  // 5. Staff acknowledged older version but not current
  for (const script of roomScripts) {
    if (!script.currentVersionId) continue;
    for (const staff of state.staffMembers.filter((s) => s.active)) {
      const hasCurrentAck = state.acknowledgements.some(
        (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId
      );
      const hasOlderAck = state.acknowledgements.some(
        (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId !== script.currentVersionId
      );
      if (hasOlderAck && !hasCurrentAck) {
        issues.push(
          makeIssue(
            room.id, 'warning', 'Outdated Acknowledgement',
            `${staff.name} acknowledged an older version of "${script.title}" but not the current version.`,
            `Ask ${staff.name} to review and acknowledge the current version.`
          )
        );
      }
    }
  }

  // 6. Draft newer than current version
  for (const script of roomScripts) {
    if (!script.currentVersionId) continue;
    const currentVersion = state.scriptVersions.find((v) => v.id === script.currentVersionId);
    if (!currentVersion) continue;
    const newerDraft = state.scriptVersions.find(
      (v) => v.scriptId === script.id && v.approvalStatus === 'draft' && v.createdAt > currentVersion.createdAt
    );
    if (newerDraft) {
      issues.push(
        makeIssue(
          room.id, 'improvement', 'Pending Draft',
          `Script "${script.title}" has a draft version (v${newerDraft.versionNumber}) newer than the current approved version.`,
          'Review the draft and either approve it as current or discard it.'
        )
      );
    }
  }

  // 7. Pronunciation terms missing phonetic entries
  const roomTerms = state.pronunciationTerms.filter((t) => t.roomId === room.id);
  for (const term of roomTerms) {
    if (!term.phonetic || term.phonetic.trim() === '') {
      issues.push(
        makeIssue(
          room.id, 'improvement', 'Pronunciation Guide',
          `Term "${term.term}" is missing a phonetic spelling.`,
          'Add a phonetic spelling to help GMs deliver the term confidently.'
        )
      );
    }
  }

  // 8. Hint ladder with only high-spoiler hints
  const roomHintLadders = state.hintLadders.filter((h) => h.roomId === room.id);
  for (const ladder of roomHintLadders) {
    const hasHighSpoiler = ladder.hints.some((h) => h.spoilerLevel === 'high');
    const hasLowOrMedium = ladder.hints.some((h) => h.spoilerLevel === 'low' || h.spoilerLevel === 'medium');
    if (hasHighSpoiler && !hasLowOrMedium) {
      issues.push(
        makeIssue(
          room.id, 'improvement', 'Hint Ladder Gap',
          `Hint ladder "${ladder.puzzleLabel}" jumps straight to high-spoiler hints with no low or medium hints.`,
          'Add lower-spoiler hints so GMs can guide without immediately revealing the solution.'
        )
      );
    }
  }

  // 9. Script not attached to a room
  const orphanScripts = state.scripts.filter(
    (s) => !s.roomId || !state.rooms.find((r) => r.id === s.roomId)
  );
  for (const script of orphanScripts) {
    issues.push(
      makeIssue(
        room.id, 'warning', 'Unassigned Script',
        `Script "${script.title}" is not attached to any room.`,
        'Assign this script to a room or delete it if no longer needed.'
      )
    );
  }

  // 10. No staff have acknowledged any current scripts
  if (currentVersionIds.length > 0) {
    const noStaffAcknowledged = state.staffMembers
      .filter((s) => s.active)
      .every((staff) =>
        currentVersionIds.every(
          (vid) => !state.acknowledgements.some((a) => a.staffId === staff.id && a.versionId === vid)
        )
      );
    if (noStaffAcknowledged && state.staffMembers.filter((s) => s.active).length > 0) {
      issues.push(
        makeIssue(
          room.id, 'warning', 'No Acknowledgements',
          `No active staff have acknowledged any current script versions for "${room.name}".`,
          'Ensure all active GMs review and acknowledge current script versions before running games.'
        )
      );
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const improvementCount = issues.filter((i) => i.severity === 'improvement').length;
  const penalty = criticalCount * 20 + warningCount * 8 + improvementCount * 3;
  const score = Math.max(0, 100 - penalty);

  return { roomId: room.id, score, issues, criticalCount, warningCount, improvementCount, generatedAt: new Date().toISOString() };
}

export function runAllAudits(state: AppState): ScriptReadinessResult[] {
  return state.rooms.map((room) => runAudit(state, room));
}
