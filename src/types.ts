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

export type ApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export type SpoilerLevel = 'low' | 'medium' | 'high';

export type IssueSeverity = 'critical' | 'warning' | 'improvement';

export interface Room {
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

export interface Script {
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

export interface ScriptVersion {
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
}

export interface HintStep {
  level: number;
  text: string;
  spoilerLevel: SpoilerLevel;
}

export interface HintLadder {
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

export interface PronunciationTerm {
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

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  active: boolean;
  notes: string;
}

export interface Acknowledgement {
  id: string;
  staffId: string;
  scriptId: string;
  versionId: string;
  acknowledgedAt: string;
  notes: string;
}

export interface ScriptReadinessIssue {
  id: string;
  roomId: string;
  severity: IssueSeverity;
  category: string;
  description: string;
  recommendation: string;
}

export interface ScriptReadinessResult {
  roomId: string;
  score: number;
  issues: ScriptReadinessIssue[];
  criticalCount: number;
  warningCount: number;
  improvementCount: number;
  generatedAt: string;
}

export interface AppState {
  rooms: Room[];
  scripts: Script[];
  scriptVersions: ScriptVersion[];
  hintLadders: HintLadder[];
  pronunciationTerms: PronunciationTerm[];
  staffMembers: StaffMember[];
  acknowledgements: Acknowledgement[];
}
