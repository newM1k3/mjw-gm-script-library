type AIProvider = 'openai' | 'gemini';

type RewriteSettings = {
  tone?: string;
  clarity?: string;
  length?: string;
  audience?: string;
  readingLevel?: string;
};

type RewriteRequest = {
  script?: {
    id?: string;
    title?: string;
    scriptType?: string;
    audience?: string;
  };
  sourceVersion?: {
    id?: string | null;
    versionNumber?: string;
    bodyMarkdown?: string;
    toneNotes?: string;
  };
  requiredBlocks?: string[];
  optionalBlocks?: string[];
  settings?: RewriteSettings;
};

type HandlerEvent = {
  httpMethod: string;
  body: string | null;
  headers?: Record<string, string | undefined>;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const rateLimitBuckets = new Map<string, number[]>();

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function normalizeSafetyText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function checkRequiredBlocks(requiredBlocks: string[], bodyMarkdown: string) {
  const normalizedBody = normalizeSafetyText(bodyMarkdown);
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

function clientKey(event: HandlerEvent): string {
  return event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || event.headers?.['client-ip'] || 'unknown-client';
}

function isRateLimited(event: HandlerEvent): boolean {
  const key = clientKey(event);
  const now = Date.now();
  const recent = (rateLimitBuckets.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitBuckets.set(key, recent);
  return false;
}

function parseRequest(event: HandlerEvent): RewriteRequest | null {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body) as RewriteRequest;
  } catch {
    return null;
  }
}

function validateRequest(payload: RewriteRequest | null): string[] {
  const errors: string[] = [];
  if (!payload) return ['Request body must be valid JSON.'];
  if (!payload.script?.id) errors.push('Script id is required.');
  if (!payload.script?.title) errors.push('Script title is required.');
  if (!payload.sourceVersion?.bodyMarkdown?.trim()) errors.push('Source script body is required.');
  if (!Array.isArray(payload.requiredBlocks)) errors.push('Required safety/policy blocks must be provided separately as an array.');
  if (!payload.settings?.audience?.trim()) errors.push('Rewrite audience is required.');
  return errors;
}

function buildPrompt(payload: RewriteRequest): string {
  const requiredBlocks = (payload.requiredBlocks ?? []).map((block, index) => `${index + 1}. ${block}`).join('\n') || 'None supplied.';
  const optionalBlocks = (payload.optionalBlocks ?? []).join(', ') || 'None supplied.';
  const settings = payload.settings ?? {};

  return `You are assisting an escape-room operations manager with a controlled script rewrite. Rewrite only the script body.\n\nNon-negotiable safety and policy blocks are supplied separately below. They must be preserved verbatim or with no weakening of meaning. If a block already appears in the source script, keep it in the rewritten script. Do not remove safety, emergency, accessibility, force, time-limit, waiver, hint-policy, or staff-instruction requirements.\n\nScript: ${payload.script?.title ?? 'Untitled'}\nScript type: ${payload.script?.scriptType ?? 'unknown'}\nRequested tone: ${settings.tone ?? 'same'}\nRequested clarity level: ${settings.clarity ?? 'standard'}\nRequested length: ${settings.length ?? 'same_length'}\nAudience: ${settings.audience ?? payload.script?.audience ?? 'players'}\nReading level: ${settings.readingLevel ?? 'plain_language'}\nExisting tone notes: ${payload.sourceVersion?.toneNotes ?? ''}\nOptional blocks: ${optionalBlocks}\n\nRequired safety/policy blocks, passed separately from the source script:\n${requiredBlocks}\n\nReturn only the rewritten Markdown body. Do not include commentary, explanations, code fences, or approval language.\n\nSource script body:\n${payload.sourceVersion?.bodyMarkdown ?? ''}`;
}

async function callOpenAI(apiKey: string, prompt: string) {
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You rewrite operational scripts safely. Preserve all required safety and policy blocks.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI rewrite failed with ${response.status}: ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  return {
    model,
    text: String(data.choices?.[0]?.message?.content ?? '').trim(),
  };
}

async function callGemini(apiKey: string, prompt: string) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0.3 },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini rewrite failed with ${response.status}: ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  return {
    model,
    text: String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim(),
  };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed. Use POST to request a script rewrite.' });
  }

  if (isRateLimited(event)) {
    return jsonResponse(429, { error: 'AI rewrite rate limit reached. Wait one minute before trying again.' });
  }

  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase() as AIProvider;
  if (!['openai', 'gemini'].includes(provider)) {
    return jsonResponse(500, { error: 'AI_PROVIDER must be set to either openai or gemini.' });
  }

  const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, {
      error: provider === 'openai'
        ? 'OPENAI_API_KEY is not configured on the server. Add it in Netlify environment variables before using AI rewrite.'
        : 'GEMINI_API_KEY is not configured on the server. Add it in Netlify environment variables before using AI rewrite.',
      provider,
    });
  }

  const payload = parseRequest(event);
  const validationErrors = validateRequest(payload);
  if (validationErrors.length > 0 || !payload) {
    return jsonResponse(400, { error: 'Invalid rewrite request.', details: validationErrors });
  }

  try {
    const prompt = buildPrompt(payload);
    const generated = provider === 'openai' ? await callOpenAI(apiKey, prompt) : await callGemini(apiKey, prompt);
    if (!generated.text) {
      return jsonResponse(502, { error: 'The AI provider returned an empty rewrite. No draft was created.' });
    }

    const requiredBlockCheck = checkRequiredBlocks(payload.requiredBlocks ?? [], generated.text);
    const warnings = requiredBlockCheck.preserved
      ? []
      : [`Required safety/policy blocks may have been removed or weakened: ${requiredBlockCheck.missingBlocks.join(', ')}`];

    return jsonResponse(200, {
      rewrittenBodyMarkdown: generated.text,
      provider,
      model: generated.model,
      generatedAt: new Date().toISOString(),
      warnings,
      requiredBlockCheck,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI rewrite error.';
    return jsonResponse(502, { error: 'Unable to complete the AI rewrite.', provider, details: message });
  }
};
