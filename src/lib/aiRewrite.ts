import { Script, ScriptVersion } from '../types';
import { buildVersionDiff, normalizeSafetyText, VersionDiffLine } from './versionGovernance';

export type AIRewriteTone = 'warmer' | 'more_mysterious' | 'more_direct' | 'more_theatrical' | 'more_calm';
export type AIRewriteClarity = 'light' | 'standard' | 'high';
export type AIRewriteLength = 'shorter' | 'same_length' | 'longer';
export type AIRewriteReadingLevel = 'grade_6_8' | 'grade_9_10' | 'plain_language' | 'staff_technical';

export interface AIRewriteSettings {
  tone: AIRewriteTone;
  clarity: AIRewriteClarity;
  length: AIRewriteLength;
  audience: string;
  readingLevel: AIRewriteReadingLevel;
}

export interface AIRewriteRequestPayload {
  script: {
    id: string;
    title: string;
    scriptType: Script['scriptType'];
    audience: string;
  };
  sourceVersion: {
    id: string | null;
    versionNumber: string;
    bodyMarkdown: string;
    toneNotes: string;
  };
  requiredBlocks: string[];
  optionalBlocks: string[];
  settings: AIRewriteSettings;
}

export interface AIRewriteResponsePayload {
  rewrittenBodyMarkdown: string;
  provider: 'openai' | 'gemini';
  model: string;
  generatedAt: string;
  warnings: string[];
  requiredBlockCheck: RequiredBlockCheck;
}

export interface RequiredBlockCheck {
  preserved: boolean;
  missingBlocks: string[];
  alteredBlocks: string[];
}

export interface AIRewriteDraftPreview {
  bodyMarkdown: string;
  provider: 'openai' | 'gemini';
  model: string;
  generatedAt: string;
  warnings: string[];
  requiredBlockCheck: RequiredBlockCheck;
  diff: VersionDiffLine[];
}

export const defaultAIRewriteSettings: AIRewriteSettings = {
  tone: 'warmer',
  clarity: 'standard',
  length: 'same_length',
  audience: 'players',
  readingLevel: 'plain_language',
};

export function splitBlockList(raw: string): string[] {
  return raw.split(',').map((block) => block.trim()).filter(Boolean);
}

export function checkRequiredBlockPreservation(requiredBlocks: string[], candidateBody: string): RequiredBlockCheck {
  const normalizedBody = normalizeSafetyText(candidateBody);
  const missingBlocks = requiredBlocks.filter((block) => {
    const normalizedBlock = normalizeSafetyText(block);
    return normalizedBlock.length > 0 && !normalizedBody.includes(normalizedBlock);
  });

  return {
    preserved: missingBlocks.length === 0,
    missingBlocks,
    alteredBlocks: missingBlocks,
  };
}

export function buildAIRewriteRequest(
  script: Script,
  sourceVersion: ScriptVersion | null,
  bodyMarkdown: string,
  toneNotes: string,
  requiredBlocks: string[],
  optionalBlocks: string[],
  settings: AIRewriteSettings
): AIRewriteRequestPayload {
  return {
    script: {
      id: script.id,
      title: script.title,
      scriptType: script.scriptType,
      audience: script.audience,
    },
    sourceVersion: {
      id: sourceVersion?.id ?? null,
      versionNumber: sourceVersion?.versionNumber ?? 'new-draft',
      bodyMarkdown,
      toneNotes,
    },
    requiredBlocks,
    optionalBlocks,
    settings,
  };
}

export function buildAIRewriteDraftPreview(
  sourceVersion: ScriptVersion | null,
  response: AIRewriteResponsePayload,
  requiredBlocks: string[]
): AIRewriteDraftPreview {
  const requiredBlockCheck = checkRequiredBlockPreservation(requiredBlocks, response.rewrittenBodyMarkdown);
  const candidateVersion: ScriptVersion = {
    id: 'ai_preview',
    scriptId: sourceVersion?.scriptId ?? 'preview',
    versionNumber: 'preview',
    bodyMarkdown: response.rewrittenBodyMarkdown,
    requiredBlocks,
    optionalBlocks: sourceVersion?.optionalBlocks ?? [],
    toneNotes: sourceVersion?.toneNotes ?? '',
    changeSummary: 'AI rewrite preview.',
    approvalStatus: 'draft',
    approvedBy: '',
    approvedAt: null,
    createdAt: response.generatedAt,
  };

  return {
    ...response,
    requiredBlockCheck,
    diff: buildVersionDiff(sourceVersion, candidateVersion),
  };
}

export function summarizeAIRewriteWarnings(check: RequiredBlockCheck, serverWarnings: string[] = []): string[] {
  return [
    ...serverWarnings,
    ...(check.preserved ? [] : [`Required blocks were changed or removed: ${check.missingBlocks.join(', ')}`]),
  ];
}
