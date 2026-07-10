import PocketBase from 'pocketbase';

import {
  Acknowledgement,
  AIRewriteMetadata,
  AppState,
  AuditEvent,
  AuditEventAction,
  AuditEventEntityType,
  HintLadder,
  PronunciationTerm,
  Room,
  Script,
  ScriptVersion,
  StaffMember,
} from '../types';
import { sampleData } from '../data/sampleData';
import { AuthStatus, AuthUser, LoginCredentials, normalizePermissionLevel } from './auth';

export type DataMode = 'demo' | 'pocketbase';

export interface AuditMetadata {
  lastGeneratedAt?: string;
  lastSavedAt?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface PersistenceAdapter {
  mode: DataMode;
  label: string;
  isDemo: boolean;
  loadAppState(): Promise<AppState>;
  saveAppState(state: AppState): Promise<void>;
  resetDemoData?(): Promise<AppState>;
  loadRooms(): Promise<Room[]>;
  saveRooms(rooms: Room[]): Promise<void>;
  loadScripts(): Promise<Script[]>;
  saveScripts(scripts: Script[]): Promise<void>;
  loadScriptVersions(): Promise<ScriptVersion[]>;
  saveScriptVersions(scriptVersions: ScriptVersion[]): Promise<void>;
  loadHintLadders(): Promise<HintLadder[]>;
  saveHintLadders(hintLadders: HintLadder[]): Promise<void>;
  loadPronunciationTerms(): Promise<PronunciationTerm[]>;
  savePronunciationTerms(pronunciationTerms: PronunciationTerm[]): Promise<void>;
  loadStaffMembers(): Promise<StaffMember[]>;
  saveStaffMembers(staffMembers: StaffMember[]): Promise<void>;
  loadAcknowledgements(): Promise<Acknowledgement[]>;
  saveAcknowledgements(acknowledgements: Acknowledgement[]): Promise<void>;
  createAcknowledgement?(acknowledgement: Acknowledgement, auditEvent: AuditEvent): Promise<{ acknowledgement: Acknowledgement; auditEvent: AuditEvent }>;
  loadAuditEvents(): Promise<AuditEvent[]>;
  saveAuditEvents(auditEvents: AuditEvent[]): Promise<void>;
  recordAuditEvent(event: AuditEvent): Promise<void>;
  loadAuditMetadata(): Promise<AuditMetadata>;
  saveAuditMetadata(metadata: AuditMetadata): Promise<void>;
  getAuthStatus(): AuthStatus;
  login?(credentials: LoginCredentials): Promise<AuthStatus>;
  loginWithToken?(token: string): Promise<AuthStatus>;
  logout?(): Promise<void>;
}

const STORAGE_KEY = 'gm_script_library_v1';
const AUDIT_METADATA_KEY = 'gm_script_library_audit_metadata_v1';

const emptyState: AppState = {
  rooms: [],
  scripts: [],
  scriptVersions: [],
  hintLadders: [],
  pronunciationTerms: [],
  staffMembers: [],
  acknowledgements: [],
  auditEvents: [],
};

const demoAuthStatus: AuthStatus = {
  isAuthenticated: true,
  user: {
    authUserId: 'demo-user',
    name: 'Demo Manager',
    email: 'demo@example.local',
    role: 'Demo Manager',
    permissionLevel: 'owner',
    staffMemberId: 'staff_1',
    isAuthenticated: true,
  },
};

function normalizeState(state: Partial<AppState> | null | undefined): AppState {
  return {
    rooms: state?.rooms ?? [],
    scripts: state?.scripts ?? [],
    scriptVersions: state?.scriptVersions ?? [],
    hintLadders: state?.hintLadders ?? [],
    pronunciationTerms: state?.pronunciationTerms ?? [],
    staffMembers: state?.staffMembers ?? [],
    acknowledgements: state?.acknowledgements ?? [],
    auditEvents: state?.auditEvents ?? [],
  };
}

function readLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    // Fall through to seeded demo data, preserving the previous storage behavior.
  }
  return normalizeState(sampleData);
}

function writeLocalState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

function updateLocalState(updater: (state: AppState) => AppState): void {
  writeLocalState(updater(readLocalState()));
}

function readLocalAuditMetadata(): AuditMetadata {
  try {
    const raw = localStorage.getItem(AUDIT_METADATA_KEY);
    if (raw) return JSON.parse(raw) as AuditMetadata;
  } catch {
    // Ignore malformed metadata and return an empty object.
  }
  return {};
}

function writeLocalAuditMetadata(metadata: AuditMetadata): void {
  localStorage.setItem(AUDIT_METADATA_KEY, JSON.stringify(metadata));
}

export const localStorageAdapter: PersistenceAdapter = {
  mode: 'demo',
  label: 'Demo localStorage',
  isDemo: true,
  async loadAppState() {
    return readLocalState();
  },
  async saveAppState(state) {
    writeLocalState(state);
  },
  async resetDemoData() {
    const seededState = normalizeState(sampleData);
    writeLocalState(seededState);
    return seededState;
  },
  async loadRooms() {
    return readLocalState().rooms;
  },
  async saveRooms(rooms) {
    updateLocalState((state) => ({ ...state, rooms }));
  },
  async loadScripts() {
    return readLocalState().scripts;
  },
  async saveScripts(scripts) {
    updateLocalState((state) => ({ ...state, scripts }));
  },
  async loadScriptVersions() {
    return readLocalState().scriptVersions;
  },
  async saveScriptVersions(scriptVersions) {
    updateLocalState((state) => ({ ...state, scriptVersions }));
  },
  async loadHintLadders() {
    return readLocalState().hintLadders;
  },
  async saveHintLadders(hintLadders) {
    updateLocalState((state) => ({ ...state, hintLadders }));
  },
  async loadPronunciationTerms() {
    return readLocalState().pronunciationTerms;
  },
  async savePronunciationTerms(pronunciationTerms) {
    updateLocalState((state) => ({ ...state, pronunciationTerms }));
  },
  async loadStaffMembers() {
    return readLocalState().staffMembers;
  },
  async saveStaffMembers(staffMembers) {
    updateLocalState((state) => ({ ...state, staffMembers }));
  },
  async loadAcknowledgements() {
    return readLocalState().acknowledgements;
  },
  async saveAcknowledgements(acknowledgements) {
    updateLocalState((state) => ({ ...state, acknowledgements }));
  },
  async createAcknowledgement(acknowledgement, auditEvent) {
    updateLocalState((state) => ({
      ...state,
      acknowledgements: [...state.acknowledgements, acknowledgement],
      auditEvents: [...(state.auditEvents ?? []), auditEvent],
    }));
    return { acknowledgement, auditEvent };
  },
  async loadAuditEvents() {
    return readLocalState().auditEvents ?? [];
  },
  async saveAuditEvents(auditEvents) {
    updateLocalState((state) => ({ ...state, auditEvents }));
  },
  async recordAuditEvent(event) {
    updateLocalState((state) => ({ ...state, auditEvents: [...(state.auditEvents ?? []), event] }));
  },
  async loadAuditMetadata() {
    return readLocalAuditMetadata();
  },
  async saveAuditMetadata(metadata) {
    writeLocalAuditMetadata(metadata);
  },
  getAuthStatus() {
    return demoAuthStatus;
  },
};

type PocketBaseRecord = Record<string, unknown> & {
  id: string;
  appId?: string;
  created?: string;
  updated?: string;
};

type PocketBaseErrorShape = {
  status?: number;
  message?: string;
  data?: unknown;
};

type AppEntity =
  | Room
  | Script
  | ScriptVersion
  | HintLadder
  | PronunciationTerm
  | StaffMember
  | Acknowledgement
  | AuditEvent;

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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordAppId(record: PocketBaseRecord): string {
  return asString(record.appId, record.id);
}

function recordOrganizationId(record: PocketBaseRecord): string | undefined {
  return optionalField(record, 'organization') ?? optionalField(record, 'organizationId');
}

function recordVenueId(record: PocketBaseRecord): string | undefined {
  return optionalField(record, 'venue');
}

function recordTimestamp(record: PocketBaseRecord, field: 'createdAt' | 'updatedAt', fallbackField: 'created' | 'updated'): string {
  return asString(record[field], asString(record[fallbackField], new Date().toISOString()));
}

function optionalAIRewrite(value: unknown): AIRewriteMetadata | undefined {
  let parsed = value;
  if (typeof parsed === 'string') {
    if (parsed.trim().length === 0) return undefined;
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as AIRewriteMetadata)
    : undefined;
}

function optionalField(record: PocketBaseRecord, field: string): string | undefined {
  const value = asString(record[field]);
  return value.length > 0 ? value : undefined;
}

function optionalNullableField(record: PocketBaseRecord, field: string): string | null | undefined {
  if (!(field in record)) return undefined;
  return asNullableString(record[field]);
}

function isPocketBaseError(error: unknown): error is PocketBaseErrorShape {
  return error !== null && typeof error === 'object' && ('status' in error || 'message' in error);
}

function describePocketBaseError(error: unknown, collectionName: string, action: string): Error {
  if (isPocketBaseError(error)) {
    const pocketBaseError = error;
    const status = pocketBaseError.status;
    if (status === 404) {
      return new Error(
        `PocketBase ${action} failed for '${collectionName}'. The collection or record was not found. Create the required collection from docs/pocketbase-schema.md and confirm the collection name is exact.`
      );
    }
    if (status === 401 || status === 403) {
      return new Error(
        `PocketBase ${action} failed for '${collectionName}'. Access rules denied the request. Check the collection list/view/create/update/delete rules and ensure the signed-in user has permission.`
      );
    }
    return new Error(
      `PocketBase ${action} failed for '${collectionName}'${status ? ` with status ${status}` : ''}: ${pocketBaseError.message ?? 'Unknown PocketBase error.'}`
    );
  }

  return new Error(`PocketBase ${action} failed for '${collectionName}': ${String(error)}`);
}

async function withPocketBaseErrors<T>(collectionName: string, action: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw describePocketBaseError(error, collectionName, action);
  }
}

function mapAuthModelToUser(model: Record<string, unknown> | null | undefined): AuthUser | null {
  if (!model) return null;
  const authUserId = asString(model.id);
  if (!authUserId) return null;

  const fallbackName = asString(model.email, 'Authenticated user');
  const name = asString(model.name, asString(model.username, fallbackName));

  return {
    authUserId,
    email: optionalField(model as PocketBaseRecord, 'email'),
    name,
    role: optionalField(model as PocketBaseRecord, 'role'),
    permissionLevel: normalizePermissionLevel(model.permissionLevel, 'viewer'),
    staffMemberId: optionalField(model as PocketBaseRecord, 'staffId'),
    isAuthenticated: true,
  };
}

function getPocketBaseAuthStatus(pb: PocketBase): AuthStatus {
  const user = mapAuthModelToUser(pb.authStore.model as Record<string, unknown> | null | undefined);
  return {
    user,
    isAuthenticated: pb.authStore.isValid && Boolean(user),
  };
}

export function mapPocketBaseRoom(record: PocketBaseRecord): Room {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    name: asString(record.name),
    theme: asString(record.theme),
    durationMinutes: asNumber(record.durationMinutes),
    difficulty: asString(record.difficulty, 'medium') as Room['difficulty'],
    status: asString(record.status, 'inactive') as Room['status'],
    notes: asString(record.notes),
    createdAt: recordTimestamp(record, 'createdAt', 'created'),
    updatedAt: recordTimestamp(record, 'updatedAt', 'updated'),
  };
}

export function mapPocketBaseScript(record: PocketBaseRecord): Script {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    roomId: asString(record.roomId),
    title: asString(record.title),
    scriptType: asString(record.scriptType, 'training_note') as Script['scriptType'],
    audience: asString(record.audience),
    status: asString(record.status, 'draft') as Script['status'],
    currentVersionId: asNullableString(record.currentVersionId),
    tags: asStringArray(record.tags),
    createdAt: recordTimestamp(record, 'createdAt', 'created'),
    updatedAt: recordTimestamp(record, 'updatedAt', 'updated'),
  };
}

export function mapPocketBaseScriptVersion(record: PocketBaseRecord): ScriptVersion {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    scriptId: asString(record.scriptId),
    versionNumber: asString(record.versionNumber),
    bodyMarkdown: asString(record.bodyMarkdown),
    requiredBlocks: asStringArray(record.requiredBlocks),
    optionalBlocks: asStringArray(record.optionalBlocks),
    toneNotes: asString(record.toneNotes),
    changeSummary: asString(record.changeSummary),
    approvalStatus: asString(record.approvalStatus, 'draft') as ScriptVersion['approvalStatus'],
    approvedBy: asString(record.approvedBy),
    approvedAt: asNullableString(record.approvedAt),
    createdAt: recordTimestamp(record, 'createdAt', 'created'),
    createdBy: optionalField(record, 'createdBy'),
    submittedBy: optionalField(record, 'submittedBy'),
    reviewedBy: optionalField(record, 'reviewedBy'),
    rejectedAt: optionalNullableField(record, 'rejectedAt'),
    safetyBlockChecksum: optionalField(record, 'safetyBlockChecksum'),
    previousVersionId: optionalNullableField(record, 'previousVersionId'),
    aiRewrite: optionalAIRewrite(record.aiRewrite),
  };
}

export function mapPocketBaseHintLadder(record: PocketBaseRecord): HintLadder {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    roomId: asString(record.roomId),
    puzzleLabel: asString(record.puzzleLabel),
    stageLabel: asString(record.stageLabel),
    triggerCondition: asString(record.triggerCondition),
    hints: asJsonArray<HintLadder['hints'][number]>(record.hints),
    notes: asString(record.notes),
    createdAt: recordTimestamp(record, 'createdAt', 'created'),
    updatedAt: recordTimestamp(record, 'updatedAt', 'updated'),
  };
}

export function mapPocketBasePronunciationTerm(record: PocketBaseRecord): PronunciationTerm {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    roomId: asString(record.roomId),
    term: asString(record.term),
    phonetic: asString(record.phonetic),
    meaning: asString(record.meaning),
    context: asString(record.context),
    deliveryNote: asString(record.deliveryNote),
    audioNoteUrl: asString(record.audioNoteUrl),
    createdAt: recordTimestamp(record, 'createdAt', 'created'),
    updatedAt: recordTimestamp(record, 'updatedAt', 'updated'),
  };
}

export function mapPocketBaseStaffMember(record: PocketBaseRecord): StaffMember {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    name: asString(record.name),
    email: optionalField(record, 'email'),
    authUserId: optionalNullableField(record, 'authUserId'),
    role: asString(record.role),
    permissionLevel: optionalField(record, 'permissionLevel') as StaffMember['permissionLevel'],
    active: asBoolean(record.active, true),
    invitedAt: optionalNullableField(record, 'invitedAt'),
    lastLoginAt: optionalNullableField(record, 'lastLoginAt'),
    notes: asString(record.notes),
  };
}

export function mapPocketBaseAcknowledgement(record: PocketBaseRecord): Acknowledgement {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    staffId: asString(record.staffId),
    scriptId: asString(record.scriptId),
    versionId: asString(record.versionId),
    acknowledgedAt: asString(record.acknowledgedAt) || asString(record.created),
    acknowledgementTextSnapshot: optionalField(record, 'acknowledgementTextSnapshot'),
    ipAddress: optionalField(record, 'ipAddress'),
    userAgent: optionalField(record, 'userAgent'),
    source: optionalField(record, 'source') as Acknowledgement['source'],
    supersededByVersionId: optionalNullableField(record, 'supersededByVersionId'),
    revokedAt: optionalNullableField(record, 'revokedAt'),
    revokedBy: optionalNullableField(record, 'revokedBy'),
    notes: asString(record.notes),
  };
}

export function mapPocketBaseAuditEvent(record: PocketBaseRecord): AuditEvent {
  return {
    id: recordAppId(record),
    organizationId: recordOrganizationId(record),
    venueId: recordVenueId(record),
    action: asString(record.action, 'update') as AuditEventAction,
    entityType: asString(record.entityType, 'app_state') as AuditEventEntityType,
    entityId: asString(record.entityId),
    roomId: optionalNullableField(record, 'roomId'),
    scriptId: optionalNullableField(record, 'scriptId'),
    versionId: optionalNullableField(record, 'versionId'),
    staffId: optionalNullableField(record, 'staffId'),
    actorStaffId: optionalNullableField(record, 'actorStaffId'),
    actorAuthUserId: optionalNullableField(record, 'actorAuthUserId'),
    summary: asString(record.summary),
    metadata: asRecord(record.metadata),
    ipAddress: optionalField(record, 'ipAddress'),
    userAgent: optionalField(record, 'userAgent'),
    createdAt: recordTimestamp(record, 'createdAt', 'created'),
  };
}

function toPocketBaseRecord(entity: AppEntity, scope?: VenueScope): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...entity, appId: entity.id };
  delete fields.id;

  if (scope) {
    // Stamp the tenant scope so the collection access rules and venue filters resolve.
    fields.organization = scope.organizationId;
    fields.venue = scope.venueId;
    fields.organizationId = scope.organizationId; // keep the legacy text field in sync
  }

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/** The signed-in user's tenant scope: their organization and the venue every row is filtered to. */
export interface VenueScope {
  organizationId: string;
  venueId: string;
}

/** A PocketBase-quoted filter for the venue every read/list/delete in this adapter is bounded by. */
function venueFilter(scope: VenueScope): string {
  return `venue = "${scope.venueId}"`;
}

/**
 * Resolve the signed-in user's tenant scope from their membership, mirroring
 * `mjw-lock-mapping-studio/src/lib/lockmap.ts` → resolveRoomContext: first active
 * membership → its organization → that org's first `projects` record (the venue).
 * Returns null when there is no valid auth or no membership/venue, so callers can
 * fall back to the local/demo path instead of running unscoped PocketBase queries.
 */
async function resolveVenueScope(pb: PocketBase): Promise<VenueScope | null> {
  if (!pb.authStore.isValid) return null;
  const uid = pb.authStore.record?.id;
  if (!uid) return null;

  const memberships = await pb.collection('memberships').getFullList({
    filter: `user = '${uid}' && status = 'active'`,
    requestKey: null,
  });
  for (const membership of memberships) {
    const organizationId = membership.organization as string;
    if (!organizationId) continue;
    const projects = await pb.collection('projects').getFullList({
      filter: `organization = '${organizationId}'`,
      requestKey: null,
    });
    const venue = projects[0];
    if (!venue) continue;
    return { organizationId, venueId: venue.id };
  }
  return null;
}

async function loadCollection<T>(
  pb: PocketBase,
  collectionName: string,
  mapper: (record: PocketBaseRecord) => T,
  scope: VenueScope,
  sort = 'created'
): Promise<T[]> {
  return withPocketBaseErrors(collectionName, 'load', async () => {
    const records = await pb
      .collection(collectionName)
      .getFullList<PocketBaseRecord>({ sort, filter: venueFilter(scope), requestKey: null });
    return records.map(mapper);
  });
}

async function saveCollection<T extends AppEntity>(
  pb: PocketBase,
  collectionName: string,
  entities: T[],
  scope: VenueScope
): Promise<void> {
  await withPocketBaseErrors(collectionName, 'save', async () => {
    const collection = pb.collection(collectionName);
    // Only this venue's rows — so the delete-reconciliation below can never reach another tenant's records.
    const existingRecords = await collection.getFullList<PocketBaseRecord>({
      filter: venueFilter(scope),
      requestKey: null,
    });
    const existingByAppId = new Map(existingRecords.map((record) => [recordAppId(record), record]));
    const nextIds = new Set(entities.map((entity) => entity.id));

    await Promise.all(
      entities.map((entity) => {
        const payload = toPocketBaseRecord(entity, scope);
        const existingRecord = existingByAppId.get(entity.id);
        return existingRecord ? collection.update(existingRecord.id, payload) : collection.create(payload);
      })
    );

    await Promise.all(
      existingRecords
        .filter((record) => !nextIds.has(recordAppId(record)))
        .map((record) => collection.delete(record.id))
    );
  });
}

function auditMetadataToEvent(metadata: AuditMetadata): AuditEvent {
  const now = new Date().toISOString();
  return {
    id: `audit_metadata_${Date.now()}`,
    action: 'update',
    entityType: 'app_state',
    entityId: 'global',
    summary: 'Saved readiness audit metadata.',
    metadata,
    createdAt: now,
  };
}

function createPocketBaseAdapter(url: string): PersistenceAdapter {
  const pb = new PocketBase(url);

  // The signed-in user's venue scope, resolved lazily after auth and cached.
  // Null means "no resolvable venue" (anonymous, no membership, or resolution
  // failed) → callers fall back to the local/demo path instead of running any
  // unscoped PocketBase query.
  let scopePromise: Promise<VenueScope | null> | null = null;

  function loadScope(forceRefresh = false): Promise<VenueScope | null> {
    if (forceRefresh) scopePromise = null;
    if (!pb.authStore.isValid) {
      scopePromise = null;
      return Promise.resolve(null);
    }
    if (!scopePromise) {
      scopePromise = resolveVenueScope(pb).catch(() => null);
    }
    return scopePromise;
  }

  return {
    mode: 'pocketbase',
    label: 'PocketBase',
    isDemo: false,
    getAuthStatus() {
      return getPocketBaseAuthStatus(pb);
    },
    async login(credentials) {
      await withPocketBaseErrors('users', 'login', async () => {
        await pb.collection('users').authWithPassword(credentials.email, credentials.password);
      });
      await loadScope(true);
      return getPocketBaseAuthStatus(pb);
    },
    async loginWithToken(token) {
      pb.authStore.save(token, null);
      try {
        await pb.collection('users').authRefresh();
      } catch {
        pb.authStore.clear();
      }
      await loadScope(true);
      return getPocketBaseAuthStatus(pb);
    },
    async logout() {
      pb.authStore.clear();
      scopePromise = null;
    },
    async loadAppState() {
      const [
        rooms,
        scripts,
        scriptVersions,
        hintLadders,
        pronunciationTerms,
        staffMembers,
        acknowledgements,
        auditEvents,
      ] = await Promise.all([
        this.loadRooms(),
        this.loadScripts(),
        this.loadScriptVersions(),
        this.loadHintLadders(),
        this.loadPronunciationTerms(),
        this.loadStaffMembers(),
        this.loadAcknowledgements(),
        this.loadAuditEvents(),
      ]);

      return {
        rooms,
        scripts,
        scriptVersions,
        hintLadders,
        pronunciationTerms,
        staffMembers,
        acknowledgements,
        auditEvents,
      };
    },
    async saveAppState(state) {
      await this.saveRooms(state.rooms);
      await this.saveScripts(state.scripts);
      await this.saveScriptVersions(state.scriptVersions);
      await this.saveHintLadders(state.hintLadders);
      await this.savePronunciationTerms(state.pronunciationTerms);
      await this.saveStaffMembers(state.staffMembers);
      await this.saveAcknowledgements(state.acknowledgements);
      if (state.auditEvents) await this.saveAuditEvents(state.auditEvents);
    },
    async loadRooms() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadRooms();
      return loadCollection(pb, collections.rooms, mapPocketBaseRoom, scope);
    },
    async saveRooms(rooms) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveRooms(rooms);
      await saveCollection(pb, collections.rooms, rooms, scope);
    },
    async loadScripts() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadScripts();
      return loadCollection(pb, collections.scripts, mapPocketBaseScript, scope);
    },
    async saveScripts(scripts) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveScripts(scripts);
      await saveCollection(pb, collections.scripts, scripts, scope);
    },
    async loadScriptVersions() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadScriptVersions();
      return loadCollection(pb, collections.scriptVersions, mapPocketBaseScriptVersion, scope);
    },
    async saveScriptVersions(scriptVersions) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveScriptVersions(scriptVersions);
      await saveCollection(pb, collections.scriptVersions, scriptVersions, scope);
    },
    async loadHintLadders() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadHintLadders();
      return loadCollection(pb, collections.hintLadders, mapPocketBaseHintLadder, scope);
    },
    async saveHintLadders(hintLadders) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveHintLadders(hintLadders);
      await saveCollection(pb, collections.hintLadders, hintLadders, scope);
    },
    async loadPronunciationTerms() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadPronunciationTerms();
      return loadCollection(pb, collections.pronunciationTerms, mapPocketBasePronunciationTerm, scope);
    },
    async savePronunciationTerms(pronunciationTerms) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.savePronunciationTerms(pronunciationTerms);
      await saveCollection(pb, collections.pronunciationTerms, pronunciationTerms, scope);
    },
    async loadStaffMembers() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadStaffMembers();
      return loadCollection(pb, collections.staffMembers, mapPocketBaseStaffMember, scope);
    },
    async saveStaffMembers(staffMembers) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveStaffMembers(staffMembers);
      await saveCollection(pb, collections.staffMembers, staffMembers, scope);
    },
    async loadAcknowledgements() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadAcknowledgements();
      return loadCollection(pb, collections.acknowledgements, mapPocketBaseAcknowledgement, scope);
    },
    async saveAcknowledgements(acknowledgements) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveAcknowledgements(acknowledgements);
      await saveCollection(pb, collections.acknowledgements, acknowledgements, scope);
    },
    async createAcknowledgement(acknowledgement, auditEvent) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.createAcknowledgement!(acknowledgement, auditEvent);
      return withPocketBaseErrors(collections.acknowledgements, 'create acknowledgement', async () => {
        const createdAcknowledgement = await pb
          .collection(collections.acknowledgements)
          .create<PocketBaseRecord>(toPocketBaseRecord(acknowledgement, scope));
        const serverAcknowledgedAt = createdAcknowledgement.created ?? acknowledgement.acknowledgedAt;
        const timestampedAcknowledgement = await pb
          .collection(collections.acknowledgements)
          .update<PocketBaseRecord>(createdAcknowledgement.id, { acknowledgedAt: serverAcknowledgedAt });

        const createdAuditEvent = await pb
          .collection(collections.auditEvents)
          .create<PocketBaseRecord>(toPocketBaseRecord({ ...auditEvent, createdAt: serverAcknowledgedAt }, scope));
        const serverAuditCreatedAt = createdAuditEvent.created ?? serverAcknowledgedAt;
        const timestampedAuditEvent = await pb
          .collection(collections.auditEvents)
          .update<PocketBaseRecord>(createdAuditEvent.id, { createdAt: serverAuditCreatedAt });

        return {
          acknowledgement: mapPocketBaseAcknowledgement(timestampedAcknowledgement),
          auditEvent: mapPocketBaseAuditEvent(timestampedAuditEvent),
        };
      });
    },
    async loadAuditEvents() {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.loadAuditEvents();
      return loadCollection(pb, collections.auditEvents, mapPocketBaseAuditEvent, scope, '-created');
    },
    async saveAuditEvents(auditEvents) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.saveAuditEvents(auditEvents);
      await saveCollection(pb, collections.auditEvents, auditEvents, scope);
    },
    async recordAuditEvent(event) {
      const scope = await loadScope();
      if (!scope) return localStorageAdapter.recordAuditEvent(event);
      await withPocketBaseErrors(collections.auditEvents, 'create audit event', async () => {
        await pb.collection(collections.auditEvents).create(toPocketBaseRecord(event, scope));
      });
    },
    async loadAuditMetadata() {
      const events = await this.loadAuditEvents();
      const metadataEvent = events.find((event) => event.entityType === 'app_state' && event.entityId === 'global');
      return {
        ...(metadataEvent?.metadata ?? {}),
        lastSavedAt: metadataEvent?.createdAt,
      };
    },
    async saveAuditMetadata(metadata) {
      await this.recordAuditEvent(auditMetadataToEvent(metadata));
    },
  };
}

function resolveDataMode(): DataMode {
  return import.meta.env.VITE_DATA_MODE === 'pocketbase' ? 'pocketbase' : 'demo';
}

export function createDataAdapter(): PersistenceAdapter {
  const mode = resolveDataMode();
  const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL;

  if (mode === 'pocketbase' && pocketBaseUrl) {
    return createPocketBaseAdapter(pocketBaseUrl);
  }

  return localStorageAdapter;
}

export const dataAdapter = createDataAdapter();
export const initialEmptyAppState = emptyState;
