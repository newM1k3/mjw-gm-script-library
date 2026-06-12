import PocketBase from 'pocketbase';

import {
  Acknowledgement,
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

function recordTimestamp(record: PocketBaseRecord, field: 'createdAt' | 'updatedAt', fallbackField: 'created' | 'updated'): string {
  return asString(record[field], asString(record[fallbackField], new Date().toISOString()));
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
    organizationId: optionalField(record, 'organizationId'),
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
    organizationId: optionalField(record, 'organizationId'),
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
    organizationId: optionalField(record, 'organizationId'),
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
    aiRewrite: optionalField(record, 'aiRewrite'),
  };
}

export function mapPocketBaseHintLadder(record: PocketBaseRecord): HintLadder {
  return {
    id: recordAppId(record),
    organizationId: optionalField(record, 'organizationId'),
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
    organizationId: optionalField(record, 'organizationId'),
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
    organizationId: optionalField(record, 'organizationId'),
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
    organizationId: optionalField(record, 'organizationId'),
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
    organizationId: optionalField(record, 'organizationId'),
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

function toPocketBaseRecord(entity: AppEntity): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...entity, appId: entity.id };
  delete fields.id;

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

async function loadCollection<T>(
  pb: PocketBase,
  collectionName: string,
  mapper: (record: PocketBaseRecord) => T,
  sort = 'created'
): Promise<T[]> {
  return withPocketBaseErrors(collectionName, 'load', async () => {
    const records = await pb.collection(collectionName).getFullList<PocketBaseRecord>({ sort });
    return records.map(mapper);
  });
}

async function saveCollection<T extends AppEntity>(
  pb: PocketBase,
  collectionName: string,
  entities: T[]
): Promise<void> {
  await withPocketBaseErrors(collectionName, 'save', async () => {
    const collection = pb.collection(collectionName);
    const existingRecords = await collection.getFullList<PocketBaseRecord>();
    const existingByAppId = new Map(existingRecords.map((record) => [recordAppId(record), record]));
    const nextIds = new Set(entities.map((entity) => entity.id));

    await Promise.all(
      entities.map((entity) => {
        const payload = toPocketBaseRecord(entity);
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
      return getPocketBaseAuthStatus(pb);
    },
    async logout() {
      pb.authStore.clear();
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
      return loadCollection(pb, collections.rooms, mapPocketBaseRoom);
    },
    async saveRooms(rooms) {
      await saveCollection(pb, collections.rooms, rooms);
    },
    async loadScripts() {
      return loadCollection(pb, collections.scripts, mapPocketBaseScript);
    },
    async saveScripts(scripts) {
      await saveCollection(pb, collections.scripts, scripts);
    },
    async loadScriptVersions() {
      return loadCollection(pb, collections.scriptVersions, mapPocketBaseScriptVersion);
    },
    async saveScriptVersions(scriptVersions) {
      await saveCollection(pb, collections.scriptVersions, scriptVersions);
    },
    async loadHintLadders() {
      return loadCollection(pb, collections.hintLadders, mapPocketBaseHintLadder);
    },
    async saveHintLadders(hintLadders) {
      await saveCollection(pb, collections.hintLadders, hintLadders);
    },
    async loadPronunciationTerms() {
      return loadCollection(pb, collections.pronunciationTerms, mapPocketBasePronunciationTerm);
    },
    async savePronunciationTerms(pronunciationTerms) {
      await saveCollection(pb, collections.pronunciationTerms, pronunciationTerms);
    },
    async loadStaffMembers() {
      return loadCollection(pb, collections.staffMembers, mapPocketBaseStaffMember);
    },
    async saveStaffMembers(staffMembers) {
      await saveCollection(pb, collections.staffMembers, staffMembers);
    },
    async loadAcknowledgements() {
      return loadCollection(pb, collections.acknowledgements, mapPocketBaseAcknowledgement);
    },
    async saveAcknowledgements(acknowledgements) {
      await saveCollection(pb, collections.acknowledgements, acknowledgements);
    },
    async createAcknowledgement(acknowledgement, auditEvent) {
      return withPocketBaseErrors(collections.acknowledgements, 'create acknowledgement', async () => {
        const createdAcknowledgement = await pb
          .collection(collections.acknowledgements)
          .create<PocketBaseRecord>(toPocketBaseRecord(acknowledgement));
        const serverAcknowledgedAt = createdAcknowledgement.created ?? acknowledgement.acknowledgedAt;
        const timestampedAcknowledgement = await pb
          .collection(collections.acknowledgements)
          .update<PocketBaseRecord>(createdAcknowledgement.id, { acknowledgedAt: serverAcknowledgedAt });

        const createdAuditEvent = await pb
          .collection(collections.auditEvents)
          .create<PocketBaseRecord>(toPocketBaseRecord({ ...auditEvent, createdAt: serverAcknowledgedAt }));
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
      return loadCollection(pb, collections.auditEvents, mapPocketBaseAuditEvent, '-created');
    },
    async saveAuditEvents(auditEvents) {
      await saveCollection(pb, collections.auditEvents, auditEvents);
    },
    async recordAuditEvent(event) {
      await withPocketBaseErrors(collections.auditEvents, 'create audit event', async () => {
        await pb.collection(collections.auditEvents).create(toPocketBaseRecord(event));
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
