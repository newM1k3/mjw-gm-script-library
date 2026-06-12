import { AppState } from '../types';
import { sampleData } from '../data/sampleData';

const STORAGE_KEY = 'gm_script_library_v1';

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // fall through
  }
  return sampleData;
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / security errors
  }
}

export function resetToSampleData(): AppState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
  } catch {
    // ignore
  }
  return sampleData;
}

/*
 * PocketBase Collection Mapping (future v2 integration)
 * -------------------------------------------------------
 * All collections live under the 'gms_' prefix to avoid conflicts.
 *
 * gms_rooms           → Room
 *   id, name, theme, durationMinutes, difficulty, status, notes, createdAt, updatedAt
 *
 * gms_scripts         → Script
 *   id, roomId (→ gms_rooms.id), title, scriptType, audience, tags (JSON),
 *   status, currentVersionId (→ gms_script_versions.id), createdAt, updatedAt
 *
 * gms_script_versions → ScriptVersion
 *   id, scriptId (→ gms_scripts.id), versionNumber, bodyMarkdown, requiredBlocks (JSON),
 *   optionalBlocks (JSON), toneNotes, changeSummary, approvalStatus, approvedBy, approvedAt, createdAt
 *
 * gms_hint_ladders    → HintLadder
 *   id, roomId (→ gms_rooms.id), puzzleLabel, stageLabel, triggerCondition,
 *   hints (JSON — HintStep[]), notes, createdAt, updatedAt
 *
 * gms_pronunciation_terms → PronunciationTerm
 *   id, roomId (→ gms_rooms.id), term, phonetic, meaning, context,
 *   deliveryNote, audioNoteUrl, createdAt, updatedAt
 *
 * gms_staff_members   → StaffMember
 *   id, name, role, active, notes, createdAt
 *
 * gms_acknowledgements → Acknowledgement
 *   id, staffId (→ gms_staff_members.id), scriptId (→ gms_scripts.id),
 *   versionId (→ gms_script_versions.id), acknowledgedAt, notes
 *
 * When migrating: replace loadAppState / saveAppState calls with
 * PocketBase SDK calls (src/lib/pocketbase.ts). Keep AppState shape
 * identical — only the transport layer changes.
 */
