import { ChangeEvent, useMemo, useState } from 'react';
import { Download, Copy, FileJson, FileText, Info, RotateCcw, Upload, Database, ShieldCheck } from 'lucide-react';
import { AppState } from '../types';
import {
  applyRoomPacketImport,
  downloadFile,
  exportAcknowledgementReportJSON,
  exportFullBackupJSON,
  exportIntegrationPacketJSON,
  exportReadinessJSON,
  exportRoomJSON,
  exportRoomMarkdown,
  GMS_EXPORT_SCHEMA_VERSION,
  ImportMode,
  previewRoomPacketImport,
  RoomPacketImportPreview,
} from '../services/exporters';
import { useToast } from '../lib/useToast';
import ConfirmModal from './ConfirmModal';

interface Props {
  state: AppState;
  isDemoMode: boolean;
  onRestoreDemoData?: () => Promise<void>;
  onApplyImportedState: (state: AppState) => void;
}

type ExportFormat = 'json' | 'markdown';

export default function ExportCenter({ state, isDemoMode, onRestoreDemoData, onApplyImportedState }: Props) {
  const { toast } = useToast();
  const [selectedRoomId, setSelectedRoomId] = useState(state.rooms[0]?.id ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [importPreview, setImportPreview] = useState<RoomPacketImportPreview | null>(null);
  const [importRawJson, setImportRawJson] = useState('');
  const [isServerExporting, setIsServerExporting] = useState(false);

  const room = state.rooms.find((r) => r.id === selectedRoomId);

  const jsonPreview = useMemo(() => (room ? exportRoomJSON(state, room.id).slice(0, 500) + '...' : ''), [room, state]);
  const mdPreview = useMemo(() => (room ? exportRoomMarkdown(state, room.id).slice(0, 500) + '...' : ''), [room, state]);

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function timestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  }

  async function copyToClipboard(content: string, label: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast(`${label} copied to clipboard.`, 'success');
    } catch {
      toast(`Unable to copy ${label}. Download the file instead.`, 'error');
    }
  }

  function safeDownload(content: string, filename: string, mimeType: string, label: string) {
    try {
      downloadFile(content, filename, mimeType);
      toast(`${label} downloaded as ${filename}.`, 'success');
    } catch {
      toast(`Unable to download ${label}. Try copying the export instead.`, 'error');
    }
  }

  function handleRoomPacket(format: ExportFormat, action: 'copy' | 'download') {
    if (!room) return;
    const isJson = format === 'json';
    const label = isJson ? 'Room packet JSON' : 'Room packet Markdown';
    const content = isJson ? exportRoomJSON(state, room.id) : exportRoomMarkdown(state, room.id);
    const filename = isJson
      ? `gms-room-packet-${slugify(room.name)}-${timestamp()}.json`
      : `gms-room-packet-${slugify(room.name)}-${timestamp()}.md`;

    if (action === 'copy') {
      void copyToClipboard(content, label);
      return;
    }
    safeDownload(content, filename, isJson ? 'application/json' : 'text/markdown', label);
  }

  function handleDownloadExport(kind: 'staff_acknowledgement_report' | 'readiness_audit_report' | 'full_backup' | 'integration_packet') {
    const filenameBase = `gms-${kind.replace(/_/g, '-')}-${timestamp()}`;
    if (kind === 'staff_acknowledgement_report') {
      safeDownload(exportAcknowledgementReportJSON(state), `${filenameBase}.json`, 'application/json', 'Staff acknowledgement report');
      return;
    }
    if (kind === 'readiness_audit_report') {
      safeDownload(exportReadinessJSON(state), `${filenameBase}.json`, 'application/json', 'Readiness audit report');
      return;
    }
    if (kind === 'full_backup') {
      safeDownload(exportFullBackupJSON(state), `${filenameBase}.json`, 'application/json', 'Full backup');
      return;
    }
    safeDownload(exportIntegrationPacketJSON(state), `${filenameBase}.json`, 'application/json', 'Integration packet');
  }

  async function handleServerSideExport() {
    setIsServerExporting(true);
    try {
      const response = await fetch('/.netlify/functions/export-gms-data?type=full_backup', {
        headers: { Accept: 'application/json' },
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Server export failed with ${response.status}`);
      }
      safeDownload(text, `gms-server-full-backup-${timestamp()}.json`, 'application/json', 'Server-side full backup');
    } catch (error) {
      toast(error instanceof Error ? `Server-side export failed: ${error.message}` : 'Server-side export failed.', 'error');
    } finally {
      setIsServerExporting(false);
    }
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      setImportRawJson(raw);
      const preview = previewRoomPacketImport(raw, state);
      setImportPreview(preview);
      toast(preview.valid ? `Preview ready for ${preview.roomName}.` : 'Import validation failed. Review the errors before continuing.', preview.valid ? 'success' : 'error');
    };
    reader.onerror = () => toast('Unable to read the selected import file.', 'error');
    reader.readAsText(file);
  }

  function handleApplyImport(mode: ImportMode) {
    const preview = importPreview ?? previewRoomPacketImport(importRawJson, state);
    if (!preview.valid || !preview.packet) {
      toast('Import was not applied because validation failed.', 'error');
      setImportPreview(preview);
      return;
    }

    onApplyImportedState(applyRoomPacketImport(state, preview.packet, mode));
    setImportPreview(null);
    setImportRawJson('');
    setSelectedRoomId(preview.roomId);
    toast(`${preview.roomName} imported with ${mode === 'overwrite_room' ? 'room overwrite' : 'safe merge'} mode.`, 'success');
  }

  function handleOverwriteConfirmed() {
    handleApplyImport('overwrite_room');
    setConfirmOverwrite(false);
  }

  async function handleResetConfirmed() {
    if (!onRestoreDemoData) return;
    try {
      await onRestoreDemoData();
      setConfirmReset(false);
      toast('Demo data restored.', 'success');
    } catch {
      toast('Unable to restore demo data.', 'error');
    }
  }

  const exportCards = [
    {
      title: 'Staff Acknowledgement Report',
      type: 'staff_acknowledgement_report' as const,
      description: 'Compliance matrix for current, outdated, revoked, superseded, and missing staff acknowledgements.',
    },
    {
      title: 'Readiness Audit Report',
      type: 'readiness_audit_report' as const,
      description: 'Operational readiness scores, issue categories, remediation targets, metadata, and room checklists.',
    },
    {
      title: 'Full Backup',
      type: 'full_backup' as const,
      description: 'Complete operational state for backup, restore planning, or controlled administrator migration.',
    },
    {
      title: 'Integration Packet',
      type: 'integration_packet' as const,
      description: 'Compact downstream packet for MJW tools that need readiness, room, and acknowledgement summaries.',
    },
  ];

  return (
    <div className="space-y-6">
      {confirmReset && (
        <ConfirmModal
          title="Reset to Demo Data?"
          message="This will erase all your current rooms, scripts, hints, and acknowledgements and restore the built-in sample data. This cannot be undone."
          confirmLabel="Reset Demo Data"
          confirmDanger
          onConfirm={handleResetConfirmed}
          onCancel={() => setConfirmReset(false)}
        />
      )}
      {confirmOverwrite && importPreview && (
        <ConfirmModal
          title={`Overwrite ${importPreview.roomName}?`}
          message="This will replace the matching room and its room-scoped scripts, versions, hint ladders, pronunciation terms, and acknowledgements with the validated import packet. Safe merge remains available if you do not want replacement. Records in other rooms are not touched."
          confirmLabel="Overwrite room"
          confirmDanger
          onConfirm={handleOverwriteConfirmed}
          onCancel={() => setConfirmOverwrite(false)}
        />
      )}

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Export Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">Production-ready import/export contracts for GM Script Library data and MJW ecosystem integrations.</p>
          <p className="text-xs text-slate-500 mt-1">Schema version <code className="text-slate-300">{GMS_EXPORT_SCHEMA_VERSION}</code> · documented in <code className="text-slate-300">docs/export-schema.md</code></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isDemoMode && (
            <button
              onClick={handleServerSideExport}
              disabled={isServerExporting}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              aria-label="Generate server-side export from production backend"
            >
              <Database className="w-3.5 h-3.5" /> {isServerExporting ? 'Generating…' : 'Server Export'}
            </button>
          )}
          {isDemoMode && onRestoreDemoData && (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg text-sm transition-colors"
              aria-label="Reset to demo data"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Demo Data
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Select Room for Room Packet</label>
            <select
              className="w-full sm:w-72 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              {state.rooms.length === 0 && <option value="">No rooms available</option>}
            </select>
            {room && (
              <div className="mt-3 text-xs text-slate-500">
                {state.scripts.filter((s) => s.roomId === room.id).length} scripts · {state.hintLadders.filter((h) => h.roomId === room.id).length} hint ladders · {state.pronunciationTerms.filter((t) => t.roomId === room.id).length} pronunciation terms
              </div>
            )}
          </div>

          {state.rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
              <FileJson className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400">No rooms to export</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-blue-400" />
                  <h2 className="font-semibold text-slate-200">Room Packet JSON</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Schema-versioned room packet for downstream integrations and safe room-level restore.</p>
                <div className="bg-slate-900/70 rounded-lg p-3 font-mono text-xs text-slate-400 overflow-auto max-h-40">{jsonPreview}</div>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => handleRoomPacket('json', 'copy')} disabled={!room} aria-label="Copy room packet JSON to clipboard" className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-40"><Copy className="w-4 h-4" /> Copy JSON</button>
                  <button onClick={() => handleRoomPacket('json', 'download')} disabled={!room} aria-label="Download room packet JSON file" className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"><Download className="w-4 h-4" /> Download JSON</button>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-semibold text-slate-200">Markdown Script Packet</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">Human-readable room script packet for printing, sharing, training, and operations review.</p>
                <div className="bg-slate-900/70 rounded-lg p-3 font-mono text-xs text-slate-400 overflow-auto max-h-40 whitespace-pre-wrap">{mdPreview}</div>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => handleRoomPacket('markdown', 'copy')} disabled={!room} aria-label="Copy Markdown to clipboard" className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-40"><Copy className="w-4 h-4" /> Copy Markdown</button>
                  <button onClick={() => handleRoomPacket('markdown', 'download')} disabled={!room} aria-label="Download Markdown file" className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"><Download className="w-4 h-4" /> Download Markdown</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-violet-400" />
              <h2 className="font-semibold text-slate-200">Additional JSON Exports</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exportCards.map((card) => (
                <div key={card.type} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-200">{card.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 min-h-12">{card.description}</p>
                  <button onClick={() => handleDownloadExport(card.type)} className="mt-3 flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs transition-colors" aria-label={`Download ${card.title}`}>
                    <Download className="w-3.5 h-3.5" /> Download JSON
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              <h2 className="font-semibold text-slate-200">Import Room Packet</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">Import validates the packet first. Nothing changes until you choose safe merge or room overwrite.</p>
            <label className="block">
              <span className="sr-only">Choose room packet JSON export</span>
              <input type="file" accept="application/json,.json" onChange={handleImportFile} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-700 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-amber-600" />
            </label>

            {importPreview && (
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-200">{importPreview.roomName}</div>
                  <div className="text-xs text-slate-500">Room ID: {importPreview.roomId || '—'}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-500">Scripts</span><div className="text-slate-200 font-semibold">{importPreview.counts.scripts}</div></div>
                  <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-500">Versions</span><div className="text-slate-200 font-semibold">{importPreview.counts.scriptVersions}</div></div>
                  <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-500">Hints</span><div className="text-slate-200 font-semibold">{importPreview.counts.hintLadders}</div></div>
                  <div className="bg-slate-800/60 rounded p-2"><span className="text-slate-500">Pronunciation</span><div className="text-slate-200 font-semibold">{importPreview.counts.pronunciationTerms}</div></div>
                </div>
                {(importPreview.errors.length > 0 || importPreview.warnings.length > 0) && (
                  <div className="space-y-2">
                    {importPreview.errors.map((error) => <p key={error} className="text-xs text-red-300">Error: {error}</p>)}
                    {importPreview.warnings.map((warning) => <p key={warning} className="text-xs text-amber-300">Warning: {warning}</p>)}
                  </div>
                )}
                <div className="text-xs text-slate-500">Duplicates: room {importPreview.duplicates.room ? 'yes' : 'no'} · records {importPreview.duplicates.scripts + importPreview.duplicates.scriptVersions + importPreview.duplicates.hintLadders + importPreview.duplicates.pronunciationTerms + importPreview.duplicates.acknowledgements}</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => handleApplyImport('merge')} disabled={!importPreview.valid} className="px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium">Safe Merge</button>
                  <button onClick={() => setConfirmOverwrite(true)} disabled={!importPreview.valid} className="px-3 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium" aria-label={`Confirm overwrite import for ${importPreview.roomName}`}>Overwrite Room</button>
                  <button onClick={() => { setImportPreview(null); setImportRawJson(''); setConfirmOverwrite(false); }} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Integration Destinations</h3>
            <div className="space-y-3">
              {[
                { name: 'RoomReady Ops', use: 'Convert current-script acknowledgements into pre-shift readiness tasks.' },
                { name: 'Puzzle Flow Visualizer', use: 'Associate hint ladders with puzzle flow stages and scaffold hint entries.' },
                { name: 'Puzzle Dependency Auditor', use: 'Use readiness and hint coverage to flag progression risk.' },
                { name: 'MJW Operator Toolkit', use: 'Bundle operational exports for unified shift readiness.' },
              ].map((dest) => (
                <div key={dest.name} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-200">{dest.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-blue-900/30 text-blue-300 border-blue-700/40">schema {GMS_EXPORT_SCHEMA_VERSION}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{dest.use}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
              <span>In production, server-side exports should be generated from PocketBase through the Netlify function so backups are not dependent on stale browser state.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
