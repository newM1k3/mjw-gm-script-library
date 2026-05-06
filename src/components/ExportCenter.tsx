import { useState } from 'react';
import { Download, Copy, CheckCircle, FileJson, FileText, Info } from 'lucide-react';
import { AppState } from '../types';
import { exportRoomJSON, exportRoomMarkdown, downloadFile } from '../services/exporters';

interface Props {
  state: AppState;
}

export default function ExportCenter({ state }: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState(state.rooms[0]?.id ?? '');
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  const room = state.rooms.find((r) => r.id === selectedRoomId);

  async function handleCopyJSON() {
    if (!room) return;
    await navigator.clipboard.writeText(exportRoomJSON(state, room.id));
    setCopiedJson(true); setTimeout(() => setCopiedJson(false), 2000);
  }

  function handleDownloadJSON() {
    if (!room) return;
    downloadFile(exportRoomJSON(state, room.id), `gm-script-library-${room.name.toLowerCase().replace(/\s+/g, '-')}.json`, 'application/json');
  }

  async function handleCopyMarkdown() {
    if (!room) return;
    await navigator.clipboard.writeText(exportRoomMarkdown(state, room.id));
    setCopiedMd(true); setTimeout(() => setCopiedMd(false), 2000);
  }

  function handleDownloadMarkdown() {
    if (!room) return;
    downloadFile(exportRoomMarkdown(state, room.id), `gm-script-packet-${room.name.toLowerCase().replace(/\s+/g, '-')}.md`, 'text/markdown');
  }

  const jsonPreview = room ? exportRoomJSON(state, room.id).slice(0, 400) + '...' : '';
  const mdPreview = room ? exportRoomMarkdown(state, room.id).slice(0, 400) + '...' : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Export Center</h1>
        <p className="text-slate-400 text-sm mt-0.5">Export script packets as JSON for integrations or Markdown for printing and sharing.</p>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Select Room</label>
        <select className="w-full sm:w-72 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500" value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)}>
          {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          {state.rooms.length === 0 && <option value="">No rooms available</option>}
        </select>
        {room && <div className="mt-3 text-xs text-slate-500">{state.scripts.filter((s) => s.roomId === room.id).length} scripts · {state.hintLadders.filter((h) => h.roomId === room.id).length} hint ladders · {state.pronunciationTerms.filter((t) => t.roomId === room.id).length} pronunciation terms</div>}
      </div>

      {state.rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
          <FileJson className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400">No rooms to export</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2"><FileJson className="w-5 h-5 text-blue-400" /><h2 className="font-semibold text-slate-200">JSON Export</h2></div>
            <p className="text-xs text-slate-400 leading-relaxed">Structured data for integration with RoomReady Ops, Puzzle Flow Visualizer, LockMap Studio, and the MJW Operator Toolkit. Includes rooms, scripts, versions, hint ladders, pronunciation guide, acknowledgements, and readiness audit.</p>
            <div className="bg-slate-900/70 rounded-lg p-3 font-mono text-xs text-slate-400 overflow-auto max-h-40">{jsonPreview}</div>
            <div className="flex gap-3">
              <button onClick={handleCopyJSON} disabled={!room} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-40">
                {copiedJson ? <><CheckCircle className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy JSON</>}
              </button>
              <button onClick={handleDownloadJSON} disabled={!room} className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"><Download className="w-4 h-4" /> Download JSON</button>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-400" /><h2 className="font-semibold text-slate-200">Markdown Script Packet</h2></div>
            <p className="text-xs text-slate-400 leading-relaxed">A complete, human-readable room script packet. Includes current scripts by type, hint ladders, pronunciation guide, staff acknowledgement summary, readiness score, and change history. Suitable for printing or sharing.</p>
            <div className="bg-slate-900/70 rounded-lg p-3 font-mono text-xs text-slate-400 overflow-auto max-h-40 whitespace-pre-wrap">{mdPreview}</div>
            <div className="flex gap-3">
              <button onClick={handleCopyMarkdown} disabled={!room} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-40">
                {copiedMd ? <><CheckCircle className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Markdown</>}
              </button>
              <button onClick={handleDownloadMarkdown} disabled={!room} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"><Download className="w-4 h-4" /> Download Markdown</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Integration Destinations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'RoomReady Ops', use: 'Convert current-script acknowledgements into pre-shift readiness tasks.' },
            { name: 'Puzzle Flow Visualizer', use: 'Associate hint ladders with puzzle flow stages. Import stage labels to scaffold hint entries.' },
            { name: 'Puzzle Dependency Auditor', use: 'Use dependency audit results to identify high-risk nodes and auto-suggest hint coverage.' },
            { name: 'LockMap Studio', use: 'Import ambiguous lock notes as GM hint annotations to reduce over-hinting.' },
            { name: 'Room Layout Risk Mapper', use: 'Create GM watch prompts for physical bottleneck zones from layout audits.' },
            { name: 'MJW Operator Toolkit', use: 'Bundle with RoomReady Ops for a unified pre-shift readiness and script consistency dashboard.' },
          ].map((dest) => (
            <div key={dest.name} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-200">{dest.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded border bg-slate-700/50 text-slate-500 border-slate-600/50">future</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{dest.use}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
          <span>Future integrations will connect via PocketBase at <code className="text-slate-400">VITE_POCKETBASE_URL</code>. AI-assisted script rewriting will route through a Netlify serverless function to protect the API key.</span>
        </div>
      </div>
    </div>
  );
}
