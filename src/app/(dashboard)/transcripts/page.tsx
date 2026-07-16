'use client';

import { useEffect, useState } from 'react';
import { Bot, FileText, Headphones, MessageSquare, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type Turn = { role: 'agent' | 'user'; text: string; timestamp: string };
type Transcript = { id: string; aiSummary: string; interested: boolean; sentiment: string; nextSteps: string; fullTranscript: Turn[]; createdAt: string; call: { durationSeconds: number; recordingUrl?: string | null; contact: { fullName: string; company?: string; phone: string } } };

const sentimentLabel: Record<string, string> = { positive: 'Positivo', neutral: 'Neutral', negative: 'Negativo' };

export default function TranscriptsPage() {
  const [items, setItems] = useState<Transcript[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/transcripts', { cache: 'no-store' }).then((res) => res.json()).then((data) => { setItems(data); setSelectedId(data[0]?.id || null); }).finally(() => setLoading(false)); }, []);
  const selected = items.find((item) => item.id === selectedId);

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-extrabold text-white">Transcripciones</h1><p className="mt-1 text-sm text-zinc-400">Conversaciones completas, grabaciones y análisis automático.</p></div>
    <div className="grid min-h-[620px] gap-6 lg:grid-cols-[340px_1fr]">
      <Card><CardHeader><CardTitle>Historial</CardTitle></CardHeader><CardContent className="p-2">
        {loading ? <p className="p-6 text-sm text-zinc-500">Cargando…</p> : items.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`mb-1 w-full rounded-lg border p-4 text-left transition ${selectedId === item.id ? 'border-[#3b82f6]/35 bg-[#3b82f6]/8' : 'border-transparent hover:bg-white/[0.03]'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-white">{item.call?.contact?.fullName || 'Contacto'}</p><p className="mt-0.5 text-xs text-zinc-500">{item.call?.contact?.company || item.call?.contact?.phone}</p></div><span className={`mt-1 h-2 w-2 rounded-full ${item.interested ? 'bg-[#3b82f6]' : 'bg-zinc-600'}`} /></div><div className="mt-3 flex gap-3 text-[11px] text-zinc-500"><span>{new Date(item.createdAt).toLocaleDateString('es-CO')}</span><span>{item.call?.durationSeconds || 0}s</span></div></button>)}
      </CardContent></Card>
      {selected ? <div className="space-y-6">
        <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>{selected.call?.contact?.fullName}</CardTitle><p className="mt-1 text-xs text-zinc-500">{selected.call?.contact?.phone}</p></div><span className={`rounded-full px-3 py-1 text-xs ${selected.interested ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-zinc-500/10 text-zinc-400'}`}>{selected.interested ? 'Interesado' : 'Sin interés confirmado'}</span></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-[#1f293d] bg-[#0b0f14] p-4"><p className="text-[11px] uppercase tracking-wider text-zinc-500">Sentimiento</p><p className="mt-1 font-medium text-white">{sentimentLabel[selected.sentiment] || selected.sentiment}</p></div><div className="rounded-lg border border-[#1f293d] bg-[#0b0f14] p-4"><p className="text-[11px] uppercase tracking-wider text-zinc-500">Siguiente paso</p><p className="mt-1 text-sm text-white">{selected.nextSteps}</p></div></div><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#3b82f6]"><Bot size={15} />Resumen IA</div><p className="text-sm leading-6 text-zinc-300">{selected.aiSummary}</p></div>{selected.call?.recordingUrl ? <audio controls className="w-full" src={selected.call.recordingUrl} /> : <div className="flex items-center gap-2 rounded-lg bg-white/[0.025] px-4 py-3 text-xs text-zinc-500"><Headphones size={15} />Grabación no disponible para esta llamada.</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare size={18} />Conversación</CardTitle></CardHeader><CardContent className="space-y-4">{selected.fullTranscript.map((turn, index) => <div key={index} className={`flex gap-3 ${turn.role === 'agent' ? '' : 'flex-row-reverse'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${turn.role === 'agent' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-blue-500/10 text-blue-300'}`}>{turn.role === 'agent' ? <Bot size={15} /> : <User size={15} />}</span><div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === 'agent' ? 'rounded-tl-sm bg-[#0b0f14] text-zinc-300' : 'rounded-tr-sm bg-blue-500/10 text-blue-100'}`}>{turn.text}</div></div>)}</CardContent></Card>
      </div> : <Card><CardContent className="grid h-full place-items-center text-center"><div><FileText className="mx-auto text-zinc-600" size={36} /><p className="mt-3 text-sm text-zinc-500">Selecciona una llamada para abrirla.</p></div></CardContent></Card>}
    </div>
  </div>;
}
