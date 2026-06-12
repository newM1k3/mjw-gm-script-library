import { describe, expect, it } from 'vitest';
import {
  GMS_EXPORT_SCHEMA_VERSION,
  applyRoomPacketImport,
  exportAcknowledgementReportJSON,
  exportFullBackupJSON,
  exportIntegrationPacketJSON,
  exportReadinessJSON,
  exportRoomJSON,
  exportRoomMarkdown,
  previewRoomPacketImport,
} from './exporters';
import type { AppState, Script } from '../types';

const baseDate = '2026-01-01T00:00:00.000Z';
const currentDate = '2026-01-02T00:00:00.000Z';

function exportReadyState(): AppState {
  return {
    rooms: [
      {
        id: 'room-1',
        name: 'Clockwork Vault',
        theme: 'Victorian heist',
        durationMinutes: 60,
        difficulty: 'medium',
        status: 'active',
        notes: 'Keep intro brisk.',
        createdAt: baseDate,
        updatedAt: currentDate,
      },
    ],
    scripts: [
      {
        id: 'pre-game-script',
        roomId: 'room-1',
        title: 'Pre-Game Briefing',
        scriptType: 'pre_game_brief',
        audience: 'players',
        status: 'current',
        currentVersionId: 'pre-game-current',
        tags: ['opening'],
        createdAt: baseDate,
        updatedAt: currentDate,
      },
      {
        id: 'safety-script',
        roomId: 'room-1',
        title: 'Safety Briefing',
        scriptType: 'safety_brief',
        audience: 'players',
        status: 'current',
        currentVersionId: 'safety-current',
        tags: ['safety'],
        createdAt: baseDate,
        updatedAt: currentDate,
      },
    ],
    scriptVersions: [
      {
        id: 'pre-game-current',
        scriptId: 'pre-game-script',
        versionNumber: '1.0',
        bodyMarkdown: 'Welcome to the Clockwork Vault. Confirm safety before entering.',
        requiredBlocks: ['Safety confirmation'],
        optionalBlocks: [],
        toneNotes: 'Warm and confident.',
        changeSummary: 'Approved launch script.',
        approvalStatus: 'approved',
        approvedBy: 'Ops Lead',
        approvedAt: currentDate,
        createdAt: currentDate,
      },
      {
        id: 'safety-current',
        scriptId: 'safety-script',
        versionNumber: '1.0',
        bodyMarkdown: 'No running. Use the emergency exit if instructed.',
        requiredBlocks: ['Emergency exit', 'No force'],
        optionalBlocks: [],
        toneNotes: 'Clear and firm.',
        changeSummary: 'Approved safety script.',
        approvalStatus: 'approved',
        approvedBy: 'Ops Lead',
        approvedAt: currentDate,
        createdAt: currentDate,
      },
    ],
    hintLadders: [
      {
        id: 'hint-1',
        roomId: 'room-1',
        puzzleLabel: 'Gear Cabinet',
        stageLabel: 'Act I',
        triggerCondition: 'Team has inspected the cabinet twice.',
        hints: [
          { level: 2, text: 'Match the brass gears by size.', spoilerLevel: 'medium' },
          { level: 1, text: 'Look for repeated gear markings.', spoilerLevel: 'low' },
        ],
        notes: 'Do not reveal the full sequence first.',
        createdAt: baseDate,
        updatedAt: currentDate,
      },
    ],
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
        notes: 'Ready to run.',
      },
      {
        id: 'ack-safety',
        staffId: 'staff-1',
        scriptId: 'safety-script',
        versionId: 'safety-current',
        acknowledgedAt: currentDate,
        notes: 'Ready to run.',
      },
    ],
    auditEvents: [],
  };
}

function expectEnvelopeShape(payload: Record<string, unknown>, exportType: string): void {
  expect(payload.gms_export_schema_version).toBe(GMS_EXPORT_SCHEMA_VERSION);
  expect(payload.version).toBe(GMS_EXPORT_SCHEMA_VERSION);
  expect(payload.sourceApp).toBe('GM Script Library');
  expect(payload.exportType).toBe(exportType);
  expect(payload.exportedAt).toEqual(expect.any(String));
  expect(payload.generatedFrom).toBe('client_state');
  expect(payload.producer).toEqual(
    expect.objectContaining({
      app: 'GM Script Library',
      platform: 'MJW Personal App Platform',
      schemaDocumentation: 'docs/export-schema.md',
    })
  );
  expect(payload.payload).toEqual(expect.any(Object));
}

describe('room exports', () => {
  it('builds a schema-versioned JSON room packet with operational references and readiness audit output', () => {
    const payload = JSON.parse(exportRoomJSON(exportReadyState(), 'room-1'));

    expectEnvelopeShape(payload, 'room_packet');
    expect(payload.reportType).toBe('room_packet');
    expect(payload.room.name).toBe('Clockwork Vault');
    expect(payload.payload.room.name).toBe('Clockwork Vault');
    expect(payload.scripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Pre-Game Briefing',
          currentVersion: expect.objectContaining({ bodyMarkdown: expect.stringContaining('Welcome to the Clockwork Vault') }),
        }),
        expect.objectContaining({
          title: 'Safety Briefing',
          currentVersion: expect.objectContaining({ bodyMarkdown: expect.stringContaining('No running') }),
        }),
      ])
    );
    expect(payload.hintLadders).toEqual(expect.arrayContaining([expect.objectContaining({ puzzleLabel: 'Gear Cabinet' })]));
    expect(payload.pronunciationGuide).toEqual(expect.arrayContaining([expect.objectContaining({ term: 'Aethelred', phonetic: 'ETH-el-red' })]));
    expect(payload.acknowledgements).toEqual(expect.arrayContaining([expect.objectContaining({ staffName: 'Jordan GM', versionId: 'pre-game-current' })]));
    expect(payload.scriptReadinessAudit).toEqual(expect.objectContaining({ roomId: 'room-1', score: 100, issues: [] }));
    expect(payload.integrationHints).toEqual(expect.objectContaining({ pocketBaseIntegration: expect.stringContaining('gms_rooms') }));
  });

  it('builds a Markdown packet with the room, current scripts, operational references, audit output, and schema version', () => {
    const markdown = exportRoomMarkdown(exportReadyState(), 'room-1');

    expect(markdown).toContain('# GM Script Library — Room Script Packet');
    expect(markdown).toContain(`**Schema Version:** ${GMS_EXPORT_SCHEMA_VERSION}`);
    expect(markdown).toContain('**Room:** Clockwork Vault');
    expect(markdown).toContain('## Script Readiness Score: 100/100');
    expect(markdown).toContain('### Safety Briefing');
    expect(markdown).toContain('No running. Use the emergency exit if instructed.');
    expect(markdown).toContain('### Pre-Game Briefing');
    expect(markdown).toContain('Welcome to the Clockwork Vault. Confirm safety before entering.');
    expect(markdown).toContain('## Hint Ladders');
    expect(markdown).toContain('### Gear Cabinet');
    expect(markdown).toContain('Look for repeated gear markings.');
    expect(markdown).toContain('## Pronunciation Guide');
    expect(markdown).toContain('**Phonetic:** ETH-el-red');
    expect(markdown).toContain('## Staff Acknowledgement Summary');
    expect(markdown).toContain('### Jordan GM (Game Master)');
    expect(markdown).toContain('- **Pre-Game Briefing:** Acknowledged');
  });
});

describe('schema-versioned export contracts', () => {
  it('adds stable envelopes to every JSON export type used by the Export Center', () => {
    const state = exportReadyState();
    const exports = [
      ['staff_acknowledgement_report', JSON.parse(exportAcknowledgementReportJSON(state))],
      ['readiness_audit_report', JSON.parse(exportReadinessJSON(state))],
      ['full_backup', JSON.parse(exportFullBackupJSON(state))],
      ['integration_packet', JSON.parse(exportIntegrationPacketJSON(state))],
    ] as const;

    exports.forEach(([exportType, payload]) => expectEnvelopeShape(payload, exportType));
    expect(exports[0][1].payload.summary.totalRows).toBe(2);
    expect(exports[1][1].payload.metadata).toEqual(expect.objectContaining({ roomCount: 1, issueCount: 0 }));
    expect(exports[2][1].payload.state.rooms).toHaveLength(1);
    expect(exports[3][1].payload.downstreamConsumers).toEqual(expect.arrayContaining(['RoomReady Ops', 'MJW Operator Toolkit']));
  });
});

describe('room packet import validation and safe restore', () => {
  it('previews a room packet before modifying data and reports duplicate record handling', () => {
    const state = exportReadyState();
    const preview = previewRoomPacketImport(exportRoomJSON(state, 'room-1'), state);

    expect(preview.valid).toBe(true);
    expect(preview.roomName).toBe('Clockwork Vault');
    expect(preview.counts).toEqual({ rooms: 1, scripts: 2, scriptVersions: 2, hintLadders: 1, pronunciationTerms: 1, acknowledgements: 2 });
    expect(preview.duplicates).toEqual({ room: true, scripts: 2, scriptVersions: 2, hintLadders: 1, pronunciationTerms: 1, acknowledgements: 2 });
    expect(preview.packet?.room.id).toBe('room-1');
    expect(preview.warnings.join(' ')).toContain('already exists');
  });

  it('rejects invalid JSON and malformed room packet records without applying changes', () => {
    const state = exportReadyState();
    expect(previewRoomPacketImport('{not-json', state)).toEqual(
      expect.objectContaining({ valid: false, errors: ['The selected file is not valid JSON.'] })
    );

    const malformed = previewRoomPacketImport(JSON.stringify({ exportType: 'room_packet', payload: { room: { id: '', name: '' }, scripts: [] } }), state);
    expect(malformed.valid).toBe(false);
    expect(malformed.errors).toEqual(expect.arrayContaining(['The room packet must include a room with id and name.']));
  });

  it('merges a validated room packet without deleting unrelated operational data', () => {
    const currentState = exportReadyState();
    const importedState = exportReadyState();
    importedState.rooms[0] = { ...importedState.rooms[0], id: 'room-2', name: 'Mirror Library' };
    importedState.scripts = importedState.scripts.map((script) => ({ ...script, id: `room-2-${script.id}`, roomId: 'room-2', currentVersionId: `room-2-${script.currentVersionId}` }));
    importedState.scriptVersions = importedState.scriptVersions.map((version) => ({ ...version, id: `room-2-${version.id}`, scriptId: `room-2-${version.scriptId}` }));
    importedState.hintLadders = importedState.hintLadders.map((ladder) => ({ ...ladder, id: 'room-2-hint-1', roomId: 'room-2' }));
    importedState.pronunciationTerms = importedState.pronunciationTerms.map((term) => ({ ...term, id: 'room-2-term-1', roomId: 'room-2' }));
    importedState.acknowledgements = importedState.acknowledgements.map((ack) => ({ ...ack, id: `room-2-${ack.id}`, scriptId: `room-2-${ack.scriptId}`, versionId: `room-2-${ack.versionId}` }));

    const preview = previewRoomPacketImport(exportRoomJSON(importedState, 'room-2'), currentState);
    expect(preview.valid).toBe(true);
    expect(preview.duplicates.room).toBe(false);

    const nextState = applyRoomPacketImport(currentState, preview.packet!, 'merge');
    expect(nextState.rooms.map((room) => room.name)).toEqual(expect.arrayContaining(['Clockwork Vault', 'Mirror Library']));
    expect(nextState.scripts).toHaveLength(4);
    expect(nextState.auditEvents.at(-1)).toEqual(expect.objectContaining({ action: 'import', entityType: 'room_packet', roomId: 'room-2' }));
  });

  it('overwrites only the imported room packet scope and preserves unrelated rooms', () => {
    const currentState = exportReadyState();
    const unrelatedScript: Script = {
      id: 'orphaned-old-room-script',
      roomId: 'room-1',
      title: 'Old Retired Script',
      scriptType: 'training_note',
      audience: 'staff',
      status: 'archived',
      currentVersionId: null,
      tags: [],
      createdAt: baseDate,
      updatedAt: baseDate,
    };
    const staleState: AppState = {
      ...currentState,
      scripts: [...currentState.scripts, unrelatedScript],
      rooms: [...currentState.rooms, { ...currentState.rooms[0], id: 'room-other', name: 'Unrelated Room' }],
    };

    const preview = previewRoomPacketImport(exportRoomJSON(currentState, 'room-1'), staleState);
    const nextState = applyRoomPacketImport(staleState, preview.packet!, 'overwrite_room');

    expect(nextState.rooms.map((room) => room.id)).toEqual(expect.arrayContaining(['room-1', 'room-other']));
    expect(nextState.scripts.some((script) => script.id === 'orphaned-old-room-script')).toBe(false);
    expect(nextState.scripts.filter((script) => script.roomId === 'room-1')).toHaveLength(2);
    expect(nextState.auditEvents.at(-1)?.summary).toContain('Overwrote room packet import');
  });
});
