import {
  AppState,
  ReadinessIssueCategory,
  RemediationScreen,
  Room,
  RoomReadinessChecklistItem,
  ScriptReadinessIssue,
  ScriptReadinessResult,
} from '../types';

let issueCounter = 0;

interface IssueInput {
  roomId: string;
  severity: ScriptReadinessIssue['severity'];
  category: ReadinessIssueCategory;
  title: string;
  description: string;
  recommendation: string;
  remediation: {
    screen: RemediationScreen;
    label: string;
    roomId?: string;
    scriptId?: string;
    staffId?: string;
    hintLadderId?: string;
    pronunciationTermId?: string;
  };
  dedupeKey: string;
}

function isArchivedText(value: string): boolean {
  return value.toLowerCase().includes('[archived]');
}

function activeHintLadders(state: AppState, roomId: string) {
  return state.hintLadders.filter((h) => h.roomId === roomId && !isArchivedText(h.notes));
}

function activePronunciationTerms(state: AppState, roomId: string) {
  return state.pronunciationTerms.filter((t) => t.roomId === roomId && !isArchivedText(t.deliveryNote));
}

function makeIssue(input: IssueInput): ScriptReadinessIssue {
  return {
    id: `issue_${input.roomId}_${++issueCounter}`,
    roomId: input.roomId,
    severity: input.severity,
    category: input.category,
    status: 'open',
    title: input.title,
    description: input.description,
    recommendation: input.recommendation,
    remediation: input.remediation,
    dedupeKey: input.dedupeKey,
  };
}

function addIssue(issues: ScriptReadinessIssue[], seen: Set<string>, input: IssueInput) {
  if (seen.has(input.dedupeKey)) return;
  seen.add(input.dedupeKey);
  issues.push(makeIssue(input));
}

export function generateRoomChecklist(state: AppState, room: Room): RoomReadinessChecklistItem[] {
  const roomScripts = state.scripts.filter((s) => s.roomId === room.id);
  const hasCurrentScriptType = (scriptType: string) => roomScripts.some((s) => s.scriptType === scriptType && s.currentVersionId);
  const currentScripts = roomScripts.filter((s) => s.currentVersionId);
  const activeStaff = state.staffMembers.filter((s) => s.active);
  const allCurrentScriptsAcknowledged = currentScripts.length > 0 && activeStaff.length > 0
    ? activeStaff.every((staff) => currentScripts.every((script) => state.acknowledgements.some((ack) => ack.staffId === staff.id && ack.scriptId === script.id && ack.versionId === script.currentVersionId && !ack.revokedAt)))
    : currentScripts.length > 0 && activeStaff.length === 0;

  return [
    {
      id: `${room.id}_room_active`,
      label: 'Room record is active and current',
      description: 'Room setup has the correct active/maintenance/retired status before staff use operational materials.',
      complete: room.status === 'active',
      category: 'room',
    },
    {
      id: `${room.id}_safety_current`,
      label: 'Current safety brief exists',
      description: 'Every active room needs an approved current safety brief for live delivery.',
      complete: hasCurrentScriptType('safety_brief'),
      category: 'script',
    },
    {
      id: `${room.id}_pregame_current`,
      label: 'Current pre-game brief exists',
      description: 'Every active room needs an approved current pre-game brief before it is operationally ready.',
      complete: hasCurrentScriptType('pre_game_brief'),
      category: 'script',
    },
    {
      id: `${room.id}_hints_available`,
      label: 'Hint ladders are available',
      description: 'At least one active hint ladder should be available for major puzzles and GM support.',
      complete: activeHintLadders(state, room.id).length > 0,
      category: 'hint',
    },
    {
      id: `${room.id}_staff_acknowledged`,
      label: 'Active staff acknowledged current scripts',
      description: 'All active staff should acknowledge current operating scripts before running the room.',
      complete: allCurrentScriptsAcknowledged,
      category: 'staff',
    },
    {
      id: `${room.id}_pronunciation_reviewed`,
      label: 'Pronunciation guide reviewed',
      description: 'Room-specific pronunciation terms should include phonetics where delivery could be inconsistent.',
      complete: activePronunciationTerms(state, room.id).every((term) => term.phonetic.trim().length > 0),
      category: 'pronunciation',
    },
  ];
}

export function runAudit(state: AppState, room: Room, dataSource: ScriptReadinessResult['dataSource'] = 'local'): ScriptReadinessResult {
  issueCounter = 0;
  const issues: ScriptReadinessIssue[] = [];
  const seen = new Set<string>();
  const roomScripts = state.scripts.filter((s) => s.roomId === room.id);
  const currentVersionIds = roomScripts
    .filter((s) => s.currentVersionId)
    .map((s) => s.currentVersionId as string);

  if (room.status === 'active') {
    const hasPreGame = roomScripts.some((s) => s.scriptType === 'pre_game_brief' && s.currentVersionId);
    if (!hasPreGame) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'critical',
        category: 'script',
        title: 'Missing current pre-game brief',
        description: `Active room "${room.name}" has no current pre-game briefing.`,
        recommendation: 'Create, review, approve, and publish a pre-game brief for this room.',
        remediation: { screen: 'editor', roomId: room.id, label: 'Create pre-game brief' },
        dedupeKey: `${room.id}:script:missing-pre-game`,
      });
    }

    const hasSafety = roomScripts.some((s) => s.scriptType === 'safety_brief' && s.currentVersionId);
    if (!hasSafety) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'critical',
        category: 'script',
        title: 'Missing current safety brief',
        description: `Active room "${room.name}" has no current safety briefing.`,
        recommendation: 'Create, review, approve, and publish a safety brief for this room.',
        remediation: { screen: 'editor', roomId: room.id, label: 'Create safety brief' },
        dedupeKey: `${room.id}:script:missing-safety`,
      });
    }

    if (activeHintLadders(state, room.id).length === 0) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'warning',
        category: 'hint',
        title: 'Missing hint ladder coverage',
        description: `Active room "${room.name}" has no active hint ladders.`,
        recommendation: 'Add at least one active hint ladder for each major puzzle.',
        remediation: { screen: 'hints', roomId: room.id, label: 'Add hint ladder' },
        dedupeKey: `${room.id}:hint:missing-ladders`,
      });
    }
  }

  for (const script of roomScripts) {
    if (!script.currentVersionId) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'warning',
        category: 'script',
        title: 'Script has no current version',
        description: `Script "${script.title}" has no current approved version.`,
        recommendation: 'Review drafts and approve a version, or archive the script if no longer needed.',
        remediation: { screen: 'editor', roomId: room.id, scriptId: script.id, label: 'Open script editor' },
        dedupeKey: `${room.id}:script:${script.id}:no-current`,
      });
    }
  }

  for (const script of roomScripts) {
    if (!script.currentVersionId) continue;
    for (const staff of state.staffMembers.filter((s) => s.active)) {
      const hasCurrentAck = state.acknowledgements.some(
        (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId === script.currentVersionId && !a.revokedAt
      );
      const hasOlderAck = state.acknowledgements.some(
        (a) => a.staffId === staff.id && a.scriptId === script.id && a.versionId !== script.currentVersionId && !a.revokedAt
      );
      if (hasOlderAck && !hasCurrentAck) {
        addIssue(issues, seen, {
          roomId: room.id,
          severity: 'warning',
          category: 'staff',
          title: 'Outdated staff acknowledgement',
          description: `${staff.name} acknowledged an older version of "${script.title}" but not the current version.`,
          recommendation: `Ask ${staff.name} to review and acknowledge the current version.`,
          remediation: { screen: 'acknowledgements', roomId: room.id, scriptId: script.id, staffId: staff.id, label: 'Open acknowledgements' },
          dedupeKey: `${room.id}:staff:${staff.id}:script:${script.id}:outdated-ack`,
        });
      }
    }
  }

  for (const script of roomScripts) {
    if (!script.currentVersionId) continue;
    const currentVersion = state.scriptVersions.find((v) => v.id === script.currentVersionId);
    if (!currentVersion) continue;
    const newerDraft = state.scriptVersions.find(
      (v) => v.scriptId === script.id && (v.approvalStatus === 'draft' || v.approvalStatus === 'in_review') && v.createdAt > currentVersion.createdAt
    );
    if (newerDraft) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'improvement',
        category: 'script',
        title: 'Pending newer version',
        description: `Script "${script.title}" has v${newerDraft.versionNumber} newer than the current approved version.`,
        recommendation: 'Review the pending version and approve, reject, archive, or roll it back.',
        remediation: { screen: 'history', roomId: room.id, scriptId: script.id, label: 'Review version history' },
        dedupeKey: `${room.id}:script:${script.id}:pending-newer`,
      });
    }
  }

  for (const term of activePronunciationTerms(state, room.id)) {
    if (!term.phonetic || term.phonetic.trim() === '') {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'improvement',
        category: 'pronunciation',
        title: 'Pronunciation term missing phonetic spelling',
        description: `Term "${term.term}" is missing a phonetic spelling.`,
        recommendation: 'Add a phonetic spelling to help GMs deliver the term confidently.',
        remediation: { screen: 'pronunciation', roomId: room.id, pronunciationTermId: term.id, label: 'Edit pronunciation term' },
        dedupeKey: `${room.id}:pronunciation:${term.id}:missing-phonetic`,
      });
    }
  }

  for (const ladder of activeHintLadders(state, room.id)) {
    const hasHighSpoiler = ladder.hints.some((h) => h.spoilerLevel === 'high');
    const hasLowOrMedium = ladder.hints.some((h) => h.spoilerLevel === 'low' || h.spoilerLevel === 'medium');
    if (hasHighSpoiler && !hasLowOrMedium) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'improvement',
        category: 'hint',
        title: 'Hint ladder jumps to high-spoiler hints',
        description: `Hint ladder "${ladder.puzzleLabel}" jumps straight to high-spoiler hints with no low or medium hints.`,
        recommendation: 'Add lower-spoiler hints so GMs can guide without immediately revealing the solution.',
        remediation: { screen: 'hints', roomId: room.id, hintLadderId: ladder.id, label: 'Edit hint ladder' },
        dedupeKey: `${room.id}:hint:${ladder.id}:high-only`,
      });
    }
  }

  if (currentVersionIds.length > 0) {
    const activeStaff = state.staffMembers.filter((s) => s.active);
    const noStaffAcknowledged = activeStaff.every((staff) =>
      currentVersionIds.every((vid) => !state.acknowledgements.some((a) => a.staffId === staff.id && a.versionId === vid && !a.revokedAt))
    );
    if (noStaffAcknowledged && activeStaff.length > 0) {
      addIssue(issues, seen, {
        roomId: room.id,
        severity: 'warning',
        category: 'staff',
        title: 'No current script acknowledgements',
        description: `No active staff have acknowledged any current script versions for "${room.name}".`,
        recommendation: 'Ensure active GMs review and acknowledge current script versions before running games.',
        remediation: { screen: 'acknowledgements', roomId: room.id, label: 'Review staff acknowledgements' },
        dedupeKey: `${room.id}:staff:no-current-acks`,
      });
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const improvementCount = issues.filter((i) => i.severity === 'improvement').length;
  const penalty = criticalCount * 20 + warningCount * 8 + improvementCount * 3;
  const score = Math.max(0, 100 - penalty);

  return {
    roomId: room.id,
    score,
    issues,
    criticalCount,
    warningCount,
    improvementCount,
    checklist: generateRoomChecklist(state, room),
    generatedAt: new Date().toISOString(),
    dataSource,
  };
}

export function runGlobalAuditIssues(state: AppState): ScriptReadinessIssue[] {
  issueCounter = 0;
  const seen = new Set<string>();
  const issues: ScriptReadinessIssue[] = [];
  const roomIds = new Set(state.rooms.map((r) => r.id));
  const orphanScripts = state.scripts.filter((s) => !s.roomId || !roomIds.has(s.roomId));

  for (const script of orphanScripts) {
    addIssue(issues, seen, {
      roomId: 'global',
      severity: 'warning',
      category: 'script',
      title: 'Unassigned script',
      description: `Script "${script.title}" is not attached to any room.`,
      recommendation: 'Assign this script to a room or archive it if no longer needed.',
      remediation: { screen: 'editor', scriptId: script.id, label: 'Assign script to room' },
      dedupeKey: `global:script:${script.id}:unassigned`,
    });
  }

  return issues;
}

export function runAllAudits(state: AppState, dataSource: ScriptReadinessResult['dataSource'] = 'local'): ScriptReadinessResult[] {
  return state.rooms.map((room) => runAudit(state, room, dataSource));
}
