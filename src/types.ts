export type RoomStatus = 'active' | 'inactive' | 'maintenance' | 'retired';
export type RoomDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type ScriptType =
  | 'pre_game_brief'
  | 'safety_brief'
  | 'story_intro'
  | 'character_intro'
  | 'hint_ladder'
  | 'mid_game_intervention'
  | 'post_game_debrief'
  | 'reset_note'
  | 'training_note';

export type ScriptStatus =
  | 'draft'
  | 'in_review'
  | 'current'
  | 'archived'
  | 'needs_update';

export type ApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'current' | 'archived';

export type SpoilerLevel = 'low' | 'medium' | 'high';

export type IssueSeverity = 'critical' | 'warning' | 'improvement';

export type ReadinessIssueCategory = 'room' | 'script' | 'staff' | 'hint' | 'pronunciation';
export type ReadinessIssueStatus = 'open' | 'resolved';
export type RemediationScreen = 'rooms' | 'editor' | 'history' | 'hints' | 'pronunciation' | 'acknowledgements' | 'scripts';

export interface ReadinessRemediationTarget {
  screen: RemediationScreen;
  label: string;
  roomId?: string;
  scriptId?: string;
  staffId?: string;
  hintLadderId?: string;
  pronunciationTermId?: string;
}

export interface RoomReadinessChecklistItem {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  category: ReadinessIssueCategory;
}

export interface ReadinessAuditFilters {
  severity?: IssueSeverity | 'all';
  roomId?: string | 'all';
  category?: ReadinessIssueCategory | 'all';
  status?: ReadinessIssueStatus | 'all';
}

export interface ReadinessAuditMetadata {
  generatedAt: string;
  dataSource: 'demo' | 'pocketbase' | 'local';
  roomCount: number;
  issueCount: number;
}

export type StaffPermissionLevel = 'owner' | 'manager' | 'lead_gm' | 'gm' | 'trainee' | 'viewer';

export type AcknowledgementSource = 'gm_mode' | 'staff_training' | 'manager_review' | 'import' | 'manual';

export type AcknowledgementStatus = 'current' | 'outdated' | 'not_acknowledged' | 'revoked' | 'superseded';

export interface AcknowledgementReportFilters {
  roomId?: string;
  staffId?: string;
  role?: string;
  status?: AcknowledgementStatus | 'all';
  scriptType?: ScriptType | 'all';
}

export interface AcknowledgementReportRow {
  roomId: string;
  roomName: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  permissionLevel: StaffPermissionLevel;
  scriptId: string;
  scriptTitle: string;
  scriptType: ScriptType;
  currentVersionId: string | null;
  currentVersionNumber: string;
  approvalDate: string | null;
  requiredBlocks: string[];
  status: AcknowledgementStatus;
  acknowledgementId: string | null;
  acknowledgedAt: string | null;
  acknowledgementTextSnapshot: string | null;
  source: AcknowledgementSource | null;
  notes: string;
}

export type AuditEventAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'submit'
  | 'reject'
  | 'archive'
  | 'rollback'
  | 'make-current'
  | 'acknowledge'
  | 'export'
  | 'import'
  | 'ai_assist';

export type AuditEventEntityType =
  | 'room'
  | 'script'
  | 'script_version'
  | 'hint_ladder'
  | 'pronunciation_term'
  | 'staff_member'
  | 'acknowledgement'
  | 'room_packet'
  | 'app_state';

export interface ProductionScopedRecord {
  /** Reserved for future multi-organization support. The current app remains single-organization. */
  organizationId?: string;
}

export interface Room extends ProductionScopedRecord {
  id: string;
  name: string;
  theme: string;
  durationMinutes: number;
  difficulty: RoomDifficulty;
  status: RoomStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Script extends ProductionScopedRecord {
  id: string;
  roomId: string;
  title: string;
  scriptType: ScriptType;
  audience: string;
  status: ScriptStatus;
  currentVersionId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AIRewriteMetadata {
  assisted: true;
  provider: 'openai' | 'gemini';
  model: string;
  generatedAt: string;
  sourceVersionId: string | null;
  settings: Record<string, string>;
  requiredBlockCheck: {
    preserved: boolean;
    missingBlocks: string[];
    alteredBlocks: string[];
  };
  warnings: string[];
}

export interface ScriptVersion extends ProductionScopedRecord {
  id: string;
  scriptId: string;
  versionNumber: string;
  bodyMarkdown: string;
  requiredBlocks: string[];
  optionalBlocks: string[];
  toneNotes: string;
  changeSummary: string;
  approvalStatus: ApprovalStatus;
  approvedBy: string;
  approvedAt: string | null;
  createdAt: string;
  createdBy?: string;
  submittedBy?: string;
  reviewedBy?: string;
  rejectedAt?: string | null;
  safetyBlockChecksum?: string;
  previousVersionId?: string | null;
  aiRewrite?: AIRewriteMetadata;
}

export interface HintStep {
  level: number;
  text: string;
  spoilerLevel: SpoilerLevel;
}

export interface HintLadder extends ProductionScopedRecord {
  id: string;
  roomId: string;
  puzzleLabel: string;
  stageLabel: string;
  triggerCondition: string;
  hints: HintStep[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PronunciationTerm extends ProductionScopedRecord {
  id: string;
  roomId: string;
  term: string;
  phonetic: string;
  meaning: string;
  context: string;
  deliveryNote: string;
  audioNoteUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember extends ProductionScopedRecord {
  id: string;
  name: string;
  role: string;
  active: boolean;
  notes: string;
  email?: string;
  authUserId?: string | null;
  permissionLevel?: StaffPermissionLevel;
  invitedAt?: string | null;
  lastLoginAt?: string | null;
}

export interface Acknowledgement extends ProductionScopedRecord {
  id: string;
  staffId: string;
  scriptId: string;
  versionId: string;
  acknowledgedAt: string;
  notes: string;
  acknowledgementTextSnapshot?: string;
  ipAddress?: string;
  userAgent?: string;
  source?: AcknowledgementSource;
  supersededByVersionId?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
}

export interface AuditEvent extends ProductionScopedRecord {
  id: string;
  action: AuditEventAction;
  entityType: AuditEventEntityType;
  entityId: string;
  roomId?: string | null;
  scriptId?: string | null;
  versionId?: string | null;
  staffId?: string | null;
  actorStaffId?: string | null;
  actorAuthUserId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ScriptReadinessIssue {
  id: string;
  roomId: string;
  severity: IssueSeverity;
  category: ReadinessIssueCategory;
  status: ReadinessIssueStatus;
  title: string;
  description: string;
  recommendation: string;
  remediation: ReadinessRemediationTarget;
  dedupeKey: string;
}

export interface ScriptReadinessResult {
  roomId: string;
  score: number;
  issues: ScriptReadinessIssue[];
  criticalCount: number;
  warningCount: number;
  improvementCount: number;
  checklist: RoomReadinessChecklistItem[];
  generatedAt: string;
  dataSource: 'demo' | 'pocketbase' | 'local';
}

export interface AppState {
  rooms: Room[];
  scripts: Script[];
  scriptVersions: ScriptVersion[];
  hintLadders: HintLadder[];
  pronunciationTerms: PronunciationTerm[];
  staffMembers: StaffMember[];
  acknowledgements: Acknowledgement[];
  auditEvents?: AuditEvent[];
}
