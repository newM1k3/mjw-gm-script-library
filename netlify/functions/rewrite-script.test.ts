import { afterEach, describe, expect, it } from 'vitest';
import { handler } from './rewrite-script';

const validBody = JSON.stringify({
  script: {
    id: 'script_1',
    title: 'Safety Brief',
    scriptType: 'safety_brief',
    audience: 'players',
  },
  sourceVersion: {
    id: 'ver_1',
    versionNumber: '1.0',
    bodyMarkdown: 'Do not climb on furniture. Ask your game master for hints.',
    toneNotes: 'Calm.',
  },
  requiredBlocks: ['Do not climb on furniture', 'Ask your game master for hints'],
  optionalBlocks: [],
  settings: {
    tone: 'warmer',
    clarity: 'standard',
    length: 'same_length',
    audience: 'players',
    readingLevel: 'plain_language',
  },
});

function event(overrides: Partial<Parameters<typeof handler>[0]> = {}): Parameters<typeof handler>[0] {
  return {
    httpMethod: 'POST',
    body: validBody,
    headers: { 'x-forwarded-for': `127.0.0.${Math.floor(Math.random() * 200) + 1}` },
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

describe('rewrite-script Netlify function', () => {
  it('rejects non-POST requests before reading provider credentials', async () => {
    const response = await handler(event({ httpMethod: 'GET' }));
    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body).error).toMatch(/Method not allowed/);
  });

  it('returns a clear missing OpenAI key message when OpenAI is selected', async () => {
    process.env.AI_PROVIDER = 'openai';
    const response = await handler(event());
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(503);
    expect(body.provider).toBe('openai');
    expect(body.error).toMatch(/OPENAI_API_KEY is not configured/);
  });

  it('returns a clear missing Gemini key message when Gemini is selected', async () => {
    process.env.AI_PROVIDER = 'gemini';
    const response = await handler(event());
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(503);
    expect(body.provider).toBe('gemini');
    expect(body.error).toMatch(/GEMINI_API_KEY is not configured/);
  });

  it('rejects unsupported provider configuration', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    const response = await handler(event());
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toMatch(/AI_PROVIDER must be set/);
  });

  it('validates the rewrite request before any provider call once server credentials exist', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key-not-used-for-invalid-payload';
    const response = await handler(event({ body: JSON.stringify({ script: { id: 'script_1' } }) }));
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('Invalid rewrite request.');
    expect(body.details).toContain('Source script body is required.');
    expect(body.details).toContain('Required safety/policy blocks must be provided separately as an array.');
  });
});
