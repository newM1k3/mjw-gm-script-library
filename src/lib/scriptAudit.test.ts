import { describe, expect, it } from 'vitest';
import { generateRoomChecklist, runAllAudits, runAudit, runGlobalAuditIssues } from './scriptAudit';
import type { AppState, HintLadder, Room, Script, ScriptReadinessIssue, ScriptVersion } from '../types';

const baseDate = '2026-01-01T00:00:00.000Z';
const currentDate = '2026-01-02T00:00:00.000Z';
const draftDate = '2026-01-03T00:00:00.000Z';

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'Clockwork Vault',
    theme: 'Victorian heist',
    durationMinutes: 60,
    difficulty: 'medium',
    status: 'active',
    notes: 'Keep intro brisk.',
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function script(overrides: Partial<Script>): Script {
  return {
    id: 'script-1',
    roomId: 'room-1',
    title: 'Opening Brief',
    scriptType: 'pre_game_brief',
    audience: 'players',
    status: 'current',
    currentVersionId: 'version-1',
    tags: ['opening'],
    createdAt: baseDate,
    updatedAt: currentDate,
    ...overrides,
  };
}

function version(overrides: Partial<ScriptVersion>): ScriptVersion {
  return {
    id: 'version-1',
    scriptId: 'script-1',
    versionNumber: '1.0',
    bodyMarkdown: 'Welcome to the Clockwork Vault.',
    requiredBlocks: ['Safety confirmation'],
    optionalBlocks: [],
    toneNotes: 'Warm and confident.',
    changeSummary: 'Approved launch script.',
    approvalStatus: 'approved',
    approvedBy: 'Ops Lead',
    approvedAt: currentDate,
    createdAt: currentDate,
    ...overrides,
  };
}

function hintLadder(overrides: Partial<HintLadder> = {}): HintLadder {
  return {
    id: 'hint-1',
    roomId: 'room-1',
    puzzleLabel: 'Gear Cabinet',
    stageLabel: 'Act I',
    triggerCondition: 'Team has inspected the cabinet twice.',
    hints: [
      { level: 1, text: 'Look for repeated gear markings.', spoilerLevel: 'low' },
      { level: 2, text: 'Match the brass gears by size.', spoilerLevel: 'medium' },
    ],
    notes: 'Do not reveal the full sequence first.',
    createdAt: baseDate,
    updatedAt: currentDate,
    ...overrides,
  };
}

function readyState(overrides: Partial<AppState> = {}): AppState {
  const preGameScript = script({
    id: 'pre-game-script',
    title: 'Pre-Game Briefing',
    scriptType: 'pre_game_brief',
    currentVersionId: 'pre-game-current',
  });
  const safetyScript = script({
    id: 'safety-script',
    title: 'Safety Briefing',
    scriptType: 'safety_brief',
    currentVersionId: 'safety-current',
  });

  const state: AppState = {
    rooms: [room()],
    scripts: [preGameScript, safetyScript],
    scriptVersions: [
      version({
        id: 'pre-game-current',
        scriptId: 'pre-game-script',
        versionNumber: '1.0',
        bodyMarkdown: 'Welcome to the Clockwork Vault. Confirm safety before entering.',
      }),
      version({
        id: 'safety-current',
        scriptId: 'safety-script',
        versionNumber: '1.0',
        bodyMarkdown: 'No running. Use the emergency exit if instructed.',
        requiredBlocks: ['Emergency exit', 'No force'],
      }),
    ],
    hintLadders: [hintLadder()],
    pronunciationTerms: [
      {
        id: 'term-1',
        roomId: 'room-1',
        term: 'Aethelred',
        phonetic: 'ETH-el-red',
        meaning: 'Vault founder',
        context: 'Story introduction',
        deliveryNote: 'Say slowly the first time.',
        audioNoteUrl: '',
        createdAt: baseDate,
        updatedAt: currentDate,
      },
    ],
    staffMembers: [
      { id: 'staff-1', name: 'Jordan GM', role: 'Game Master', active: true, notes: '' },
    ],
    acknowledgements: [
      {
        id: 'ack-pre-game',
        staffId: 'staff-1',
        scriptId: 'pre-game-script',
        versionId: 'pre-game-current',
        acknowledgedAt: currentDate,
        notes: '',
      },
      {
        id: 'ack-safety',
        staffId: 'staff-1',
        scriptId: 'safety-script',
        versionId: 'safety-current',
        acknowledgedAt: currentDate,
        notes: '',
      },
    ],
  };

  return { ...state, ...overrides };
}

function firstIssue(state: AppState, predicate: (issue: ScriptReadinessIssue) => boolean): ScriptReadinessIssue {
  const issue = runAudit(state, state.rooms[0]).issues.find(predicate);
  if (!issue) throw new Error('Expected audit issue was not generated.');
  return issue;
}

describe('script readiness audits', () => {
  it('returns no issues and a full score for a ready room', () => {
    const result = runAudit(readyState(), readyState().rooms[0], 'demo');

    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.dataSource).toBe('demo');
    expect(Date.parse(result.generatedAt)).not.toBeNaN();
  });

  it('flags an active room that is missing a current pre-game briefing', () => {
    const state = readyState({ scripts: readyState().scripts.filter((item) => item.scriptType !== 'pre_game_brief') });
    const issue = firstIssue(state, (candidate) => candidate.title === 'Missing current pre-game brief');

    expect(issue.description).toBe('Active room "Clockwork Vault" has no current pre-game briefing.');
    expect(issue.severity).toBe('critical');
    expect(issue.category).toBe('script');
    expect(issue.remediation.screen).toBe('editor');
  });

  it('flags an active room that is missing a current safety briefing', () => {
    const state = readyState({ scripts: readyState().scripts.filter((item) => item.scriptType !== 'safety_brief') });
    const issue = firstIssue(state, (candidate) => candidate.title === 'Missing current safety brief');

    expect(issue.description).toBe('Active room "Clockwork Vault" has no current safety briefing.');
    expect(issue.severity).toBe('critical');
    expect(issue.category).toBe('script');
    expect(issue.remediation.label).toBe('Create safety brief');
  });

  it('flags an active room with no hint ladder coverage', () => {
    const issue = firstIssue(readyState({ hintLadders: [] }), (candidate) => candidate.title === 'Missing hint ladder coverage');

    expect(issue.description).toBe('Active room "Clockwork Vault" has no active hint ladders.');
    expect(issue.severity).toBe('warning');
    expect(issue.category).toBe('hint');
    expect(issue.remediation.screen).toBe('hints');
  });

  it('flags a script that has no current approved version', () => {
    const noCurrentScript = script({ id: 'training-script', title: 'Training Note', scriptType: 'training_note', currentVersionId: null });
    const issue = firstIssue(readyState({ scripts: [...readyState().scripts, noCurrentScript] }), (candidate) => candidate.title === 'Script has no current version');

    expect(issue.description).toBe('Script "Training Note" has no current approved version.');
    expect(issue.category).toBe('script');
    expect(issue.remediation.scriptId).toBe('training-script');
  });

  it('flags staff who acknowledged an older script version but not the current one', () => {
    const state = readyState({
      scriptVersions: [
        ...readyState().scriptVersions,
        version({ id: 'pre-game-old', scriptId: 'pre-game-script', versionNumber: '0.9', createdAt: baseDate }),
      ],
      acknowledgements: [
        readyState().acknowledgements[1],
        {
          id: 'ack-old-pre-game',
          staffId: 'staff-1',
          scriptId: 'pre-game-script',
          versionId: 'pre-game-old',
          acknowledgedAt: baseDate,
          notes: '',
        },
      ],
    });
    const issue = firstIssue(state, (candidate) => candidate.title === 'Outdated staff acknowledgement');

    expect(issue.description).toBe('Jordan GM acknowledged an older version of "Pre-Game Briefing" but not the current version.');
    expect(issue.category).toBe('staff');
    expect(issue.remediation.screen).toBe('acknowledgements');
    expect(issue.remediation.staffId).toBe('staff-1');
  });

  it('flags a newer draft waiting behind the current approved script', () => {
    const state = readyState({
      scriptVersions: [
        ...readyState().scriptVersions,
        version({
          id: 'pre-game-draft',
          scriptId: 'pre-game-script',
          versionNumber: '1.1',
          approvalStatus: 'draft',
          approvedAt: null,
          createdAt: draftDate,
          changeSummary: 'Draft with updated pacing.',
        }),
      ],
    });
    const issue = firstIssue(state, (candidate) => candidate.title === 'Pending newer version');

    expect(issue.description).toBe('Script "Pre-Game Briefing" has v1.1 newer than the current approved version.');
    expect(issue.severity).toBe('improvement');
    expect(issue.remediation.screen).toBe('history');
  });

  it('flags pronunciation terms that lack phonetic spelling', () => {
    const issue = firstIssue(readyState({ pronunciationTerms: [{ ...readyState().pronunciationTerms[0], phonetic: '   ' }] }), (candidate) => candidate.title === 'Pronunciation term missing phonetic spelling');

    expect(issue.description).toBe('Term "Aethelred" is missing a phonetic spelling.');
    expect(issue.category).toBe('pronunciation');
    expect(issue.remediation.pronunciationTermId).toBe('term-1');
  });

  it('flags a hint ladder that jumps directly to high-spoiler guidance', () => {
    const issue = firstIssue(readyState({ hintLadders: [hintLadder({ hints: [{ level: 1, text: 'The full answer is 1847.', spoilerLevel: 'high' }] })] }), (candidate) => candidate.title === 'Hint ladder jumps to high-spoiler hints');

    expect(issue.description).toBe('Hint ladder "Gear Cabinet" jumps straight to high-spoiler hints with no low or medium hints.');
    expect(issue.category).toBe('hint');
    expect(issue.remediation.hintLadderId).toBe('hint-1');
  });

  it('flags scripts that are not attached to any existing room as global issues only', () => {
    const orphanScript = script({ id: 'orphan-script', roomId: 'missing-room', title: 'Floating Script' });
    const state = readyState({ scripts: [...readyState().scripts, orphanScript] });

    expect(runAudit(state, state.rooms[0]).issues.map((issue) => issue.description)).not.toContain('Script "Floating Script" is not attached to any room.');
    const globalIssue = runGlobalAuditIssues(state)[0];
    expect(globalIssue.description).toBe('Script "Floating Script" is not attached to any room.');
    expect(globalIssue.roomId).toBe('global');
    expect(globalIssue.category).toBe('script');
  });

  it('flags an operational risk when no active staff have acknowledged current scripts', () => {
    const issue = firstIssue(readyState({ acknowledgements: [] }), (candidate) => candidate.title === 'No current script acknowledgements');

    expect(issue.description).toBe('No active staff have acknowledged any current script versions for "Clockwork Vault".');
    expect(issue.severity).toBe('warning');
    expect(issue.category).toBe('staff');
  });

  it('deduplicates issues that share a deterministic rule key', () => {
    const state = readyState({
      hintLadders: [
        hintLadder({ id: 'hint-1', hints: [{ level: 1, text: 'Answer A.', spoilerLevel: 'high' }] }),
        hintLadder({ id: 'hint-1', hints: [{ level: 1, text: 'Answer A duplicate.', spoilerLevel: 'high' }] }),
      ],
    });

    const highOnlyIssues = runAudit(state, state.rooms[0]).issues.filter((issue) => issue.dedupeKey === 'room-1:hint:hint-1:high-only');
    expect(highOnlyIssues).toHaveLength(1);
  });

  it('calculates scoring penalties by severity', () => {
    const state = readyState({
      scripts: [],
      hintLadders: [],
      pronunciationTerms: [{ ...readyState().pronunciationTerms[0], phonetic: '' }],
      acknowledgements: [],
    });

    const result = runAudit(state, state.rooms[0]);
    expect(result.criticalCount).toBe(2);
    expect(result.warningCount).toBe(1);
    expect(result.improvementCount).toBe(1);
    expect(result.score).toBe(49);
  });

  it('generates a room readiness checklist with category coverage', () => {
    const checklist = generateRoomChecklist(readyState({ hintLadders: [] }), readyState().rooms[0]);

    expect(checklist.map((item) => item.category)).toEqual(['room', 'script', 'script', 'hint', 'staff', 'pronunciation']);
    expect(checklist.find((item) => item.id === 'room-1_hints_available')?.complete).toBe(false);
  });

  it('keeps issue IDs unique across rooms when all rooms are audited together', () => {
    const secondRoom = room({ id: 'room-2', name: 'Signal Station' });
    const state = readyState({
      rooms: [room(), secondRoom],
      scripts: [],
      scriptVersions: [],
      hintLadders: [],
      pronunciationTerms: [],
      acknowledgements: [],
    });

    const issueIds = runAllAudits(state).flatMap((result) => result.issues.map((issue) => issue.id));
    const uniqueIssueIds = new Set(issueIds);

    expect(uniqueIssueIds.size).toBe(issueIds.length);
  });
});
