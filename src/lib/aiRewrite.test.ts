import { describe, expect, it } from 'vitest';
import { Script, ScriptVersion } from '../types';
import {
  buildAIRewriteDraftPreview,
  buildAIRewriteRequest,
  checkRequiredBlockPreservation,
  defaultAIRewriteSettings,
  splitBlockList,
  summarizeAIRewriteWarnings,
} from './aiRewrite';

const script: Script = {
  id: 'script_safety_brief',
  roomId: 'room_clocktower',
  title: 'Clocktower Safety Brief',
  scriptType: 'safety_brief',
  audience: 'players',
  status: 'draft',
  currentVersionId: 'ver_1',
  tags: ['safety'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sourceVersion: ScriptVersion = {
  id: 'ver_1',
  scriptId: script.id,
  versionNumber: '1.0',
  bodyMarkdown: 'Welcome players. Do not climb on furniture. Ask your game master for hints.',
  requiredBlocks: ['Do not climb on furniture', 'Ask your game master for hints'],
  optionalBlocks: ['Birthday greeting'],
  toneNotes: 'Calm and clear.',
  changeSummary: 'Initial version.',
  approvalStatus: 'current',
  approvedBy: 'manager_1',
  approvedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AI rewrite helpers', () => {
  it('builds a browser-to-function request without API keys or provider secrets', () => {
    const payload = buildAIRewriteRequest(
      script,
      sourceVersion,
      sourceVersion.bodyMarkdown,
      sourceVersion.toneNotes,
      sourceVersion.requiredBlocks,
      sourceVersion.optionalBlocks,
      { ...defaultAIRewriteSettings, tone: 'more_theatrical', audience: 'families' }
    );

    expect(payload).toMatchObject({
      script: {
        id: script.id,
        title: script.title,
        scriptType: script.scriptType,
        audience: script.audience,
      },
      sourceVersion: {
        id: sourceVersion.id,
        versionNumber: sourceVersion.versionNumber,
        bodyMarkdown: sourceVersion.bodyMarkdown,
      },
      requiredBlocks: sourceVersion.requiredBlocks,
      optionalBlocks: sourceVersion.optionalBlocks,
      settings: {
        tone: 'more_theatrical',
        audience: 'families',
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(/api[_-]?key|OPENAI|GEMINI|secret/i);
  });

  it('normalizes comma-separated required and optional block inputs', () => {
    expect(splitBlockList(' safety , , hint policy,  time limit ')).toEqual(['safety', 'hint policy', 'time limit']);
  });

  it('preserves required safety blocks case-insensitively across candidate output', () => {
    const check = checkRequiredBlockPreservation(
      ['Do not climb on furniture', 'Ask your game master for hints'],
      'Please remember: do not climb on furniture. You can always ask your game master for hints.'
    );

    expect(check).toEqual({ preserved: true, missingBlocks: [], alteredBlocks: [] });
  });

  it('flags missing or altered required blocks before an AI draft can be saved', () => {
    const check = checkRequiredBlockPreservation(
      ['Do not climb on furniture', 'Ask your game master for hints'],
      'Please stay safe and enjoy the room.'
    );

    expect(check.preserved).toBe(false);
    expect(check.missingBlocks).toEqual(['Do not climb on furniture', 'Ask your game master for hints']);
    expect(summarizeAIRewriteWarnings(check)).toContain('Required blocks were changed or removed: Do not climb on furniture, Ask your game master for hints');
  });

  it('creates a draft preview with before-after diff and client-side required-block verification', () => {
    const preview = buildAIRewriteDraftPreview(sourceVersion, {
      rewrittenBodyMarkdown: 'Welcome, brave players. Do not climb on furniture. Ask your game master for hints whenever needed.',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      generatedAt: '2026-01-02T00:00:00.000Z',
      warnings: [],
      requiredBlockCheck: { preserved: true, missingBlocks: [], alteredBlocks: [] },
    }, sourceVersion.requiredBlocks);

    expect(preview.provider).toBe('openai');
    expect(preview.requiredBlockCheck.preserved).toBe(true);
    expect(preview.diff.some((line) => line.status === 'changed')).toBe(true);
  });
});
