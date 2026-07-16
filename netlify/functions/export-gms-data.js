const GMS_EXPORT_SCHEMA_VERSION = '1.0.0';
const GMS_SOURCE_APP = 'Scripts';

/**
 * PocketBase issues superuser tokens with a 24-hour lifetime, so a static PB_SUPERUSER_TOKEN
 * env var is dead within a day — this export returned 503 in production because of it.
 * Authenticate with PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD instead, caching per container
 * (Netlify reuses warm ones) and refreshing a minute before the JWT's own exp.
 *
 * Inlined rather than shared: this package is "type": "module" and this file is the only CJS
 * consumer, so a separate module would need its own format decision for no benefit.
 * Reference implementation: mjw-AI-escape-room-generator/netlify/functions/pbSuperuser.ts.
 */
let cachedSuperuser = null; // { token, expiresAt }

function tokenExpiryMs(token) {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return Number.isFinite(decoded.exp) ? decoded.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function getSuperuserToken(baseUrl) {
  if (cachedSuperuser && Date.now() < cachedSuperuser.expiresAt) return cachedSuperuser.token;

  const email = (process.env.PB_SUPERUSER_EMAIL || '').trim();
  const password = (process.env.PB_SUPERUSER_PASSWORD || '').trim();
  if (!email || !password) {
    throw new Error('PocketBase superuser auth is not configured (set PB_SUPERUSER_EMAIL + PB_SUPERUSER_PASSWORD).');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`PocketBase superuser auth failed (HTTP ${response.status}). ${detail.slice(0, 200)}`);
  }

  const body = await response.json();
  if (!body.token) throw new Error('PocketBase superuser auth returned no token.');

  const expiresAt = tokenExpiryMs(body.token);
  cachedSuperuser = { token: body.token, expiresAt: expiresAt ? expiresAt - 60_000 : Date.now() + 5 * 60_000 };
  return cachedSuperuser.token;
}

const collections = {
  rooms: 'gms_rooms',
  scripts: 'gms_scripts',
  scriptVersions: 'gms_script_versions',
  hintLadders: 'gms_hint_ladders',
  pronunciationTerms: 'gms_pronunciation_terms',
  staffMembers: 'gms_staff_members',
  acknowledgements: 'gms_acknowledgements',
  auditEvents: 'gms_audit_events',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body, null, 2),
  };
}

function envelope(exportType, payload, reportType) {
  return {
    gms_export_schema_version: GMS_EXPORT_SCHEMA_VERSION,
    version: GMS_EXPORT_SCHEMA_VERSION,
    sourceApp: GMS_SOURCE_APP,
    exportType,
    reportType,
    exportedAt: new Date().toISOString(),
    generatedFrom: 'server_backend',
    producer: {
      app: GMS_SOURCE_APP,
      platform: 'MJW Personal App Platform',
      schemaDocumentation: 'docs/export-schema.md',
    },
    payload,
  };
}

function normalizeRecord(record) {
  const normalized = { ...record, id: record.appId || record.id };
  delete normalized.collectionId;
  delete normalized.collectionName;
  delete normalized.expand;
  if (normalized.created && !normalized.createdAt) normalized.createdAt = normalized.created;
  if (normalized.updated && !normalized.updatedAt) normalized.updatedAt = normalized.updated;
  delete normalized.appId;
  return normalized;
}

async function fetchCollection(baseUrl, token, collectionName) {
  const url = new URL(`/api/collections/${collectionName}/records`, baseUrl);
  url.searchParams.set('perPage', '500');
  // Sort by id, not `created`: the gms_* collections predate the autodate convention and have
  // no `created` field, so PocketBase 400s the whole export. `createdAt` is not usable either
  // — gms_staff_members and gms_acknowledgements lack it. id is the only field present on all
  // eight, and keeps backups diffable.
  url.searchParams.set('sort', 'id');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PocketBase export failed for ${collectionName}: ${response.status} ${message}`);
  }

  const data = await response.json();
  return Array.isArray(data.items) ? data.items.map(normalizeRecord) : [];
}

async function loadBackendState(baseUrl, token) {
  const entries = await Promise.all(
    Object.entries(collections).map(async ([key, collectionName]) => [key, await fetchCollection(baseUrl, token, collectionName)])
  );

  return Object.fromEntries(entries);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed. Use GET for server-side export.' });
  }

  const exportType = event.queryStringParameters?.type || 'full_backup';
  if (exportType !== 'full_backup') {
    return jsonResponse(400, { error: 'Only full_backup server-side export is currently supported.' });
  }

  const baseUrl = process.env.PB_SERVICE_URL || process.env.VITE_POCKETBASE_URL;

  if (!baseUrl || !process.env.PB_SUPERUSER_EMAIL || !process.env.PB_SUPERUSER_PASSWORD) {
    return jsonResponse(503, {
      error: 'Server-side export is not configured.',
      requiredEnvironmentVariables: ['PB_SERVICE_URL', 'PB_SUPERUSER_EMAIL', 'PB_SUPERUSER_PASSWORD'],
      message: 'Configure PocketBase service credentials in Netlify to generate exports from backend data instead of client state.',
    });
  }

  try {
    const serviceToken = await getSuperuserToken(baseUrl);
    const state = await loadBackendState(baseUrl, serviceToken);
    const payload = {
      state,
      counts: Object.fromEntries(Object.entries(state).map(([key, records]) => [key, records.length])),
      restoreGuidance: {
        safeDefault: 'Validate this server-generated full backup before administrator restore.',
        supportedClientRestore: ['room_packet'],
        intendedAdminRestore: ['full_backup'],
      },
    };

    return jsonResponse(200, envelope('full_backup', payload, 'full_backup'));
  } catch (error) {
    return jsonResponse(500, {
      error: 'Server-side export failed.',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
