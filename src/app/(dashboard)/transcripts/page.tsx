'use client';

import { useEffect, useState } from 'react';
import { Bot, FileText, Headphones, MessageSquare, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type Turn = { role: 'agent' | 'user'; text: string; timestamp: string };
type Transcript = {
  id: string;
  hasTranscript: boolean;
  aiSummary: string;
  interested: boolean;
  sentiment: string;
  nextSteps: string;
  fullTranscript: Turn[];
  createdAt: string;
  call: {
    status: string;
    durationSeconds: number;
    recordingUrl?: string | null;
    contact: { fullName: string; company?: string; phone: string } | null;
  };
};

const sentimentLabel: Record<string, string> = {
  positive: 'Positivo',
  neutral: 'Neutral',
  negative: 'Negativo',
};

export default function TranscriptsPage() {
  const [items, setItems] = useState<Transcript[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/transcripts', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar el historial.');
        return data as Transcript[];
      })
      .then((data) => {
        setItems(data);
        setSelectedId(data[0]?.id || null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el historial.');
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Transcripciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conversaciones completas, grabaciones y análisis automático.</p>
      </div>

      <div className="grid min-h-[620px] gap-6 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader><CardTitle>Historial de llamadas</CardTitle></CardHeader>
          <CardContent className="p-2">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
            ) : error ? (
              <p className="p-6 text-sm text-red-400">{error}</p>
            ) : !items.length ? (
              <p className="p-6 text-sm text-muted-foreground">Todavía no hay llamadas registradas.</p>
            ) : items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`mb-1 w-full rounded-lg border p-4 text-left transition ${
                  selectedId === item.id
                    ? 'border-[#3b82f6]/35 bg-[#3b82f6]/8'
                    : 'border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{item.call.contact?.fullName || 'Contacto'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.call.contact?.company || item.call.contact?.phone}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                    item.hasTranscript ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {item.hasTranscript ? 'Lista' : 'Pendiente'}
                  </span>
                </div>
                <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                  <span>{new Date(item.createdAt).toLocaleDateString('es-CO')}</span>
                  <span>{item.call.durationSeconds || 0}s</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{selected.call.contact?.fullName || 'Contacto'}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.call.contact?.phone}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${
                  selected.hasTranscript ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {selected.hasTranscript ? 'Transcripción lista' : 'Procesando transcripción'}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Sentimiento</p>
                    <p className="mt-1 font-medium text-foreground">{sentimentLabel[selected.sentiment] || selected.sentiment}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Siguiente paso</p>
                    <p className="mt-1 text-sm text-foreground">{selected.nextSteps}</p>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#3b82f6]">
                    <Bot size={15} /> Resumen IA
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{selected.aiSummary}</p>
                </div>
                {selected.call.recordingUrl ? (
                  <audio controls className="w-full" src={selected.call.recordingUrl} />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.025] px-4 py-3 text-xs text-muted-foreground">
                    <Headphones size={15} /> Grabación no disponible para esta llamada.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare size={18} /> Conversación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {selected.fullTranscript.length ? selected.fullTranscript.map((turn, index) => (
                  <div key={index} className={`flex gap-3 ${turn.role === 'agent' ? '' : 'flex-row-reverse'}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      turn.role === 'agent' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-blue-500/10 text-blue-300'
                    }`}>
                      {turn.role === 'agent' ? <Bot size={15} /> : <User size={15} />}
                    </span>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      turn.role === 'agent'
                        ? 'rounded-tl-sm bg-background text-muted-foreground'
                        : 'rounded-tr-sm bg-blue-500/10 text-blue-100'
                    }`}>
                      {turn.text}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
                    La llamada está registrada, pero Telnyx todavía no ha entregado su transcripción.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="grid h-full place-items-center text-center">
              <div>
                <FileText className="mx-auto text-muted-foreground" size={36} />
                <p className="mt-3 text-sm text-muted-foreground">Selecciona una llamada para abrirla.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
