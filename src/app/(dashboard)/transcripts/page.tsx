'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, FileText, Headphones, MessageSquare, PhoneIncoming, PhoneOutgoing, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type Turn = { role: 'agent' | 'user'; text: string; timestamp: string };
type Direction = 'inbound' | 'outbound';
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
    direction?: Direction;
    recordingUrl?: string | null;
    contact: { fullName: string; company?: string; phone: string } | null;
  };
};

const sentimentLabel: Record<string, string> = {
  positive: 'Positivo',
  neutral: 'Neutral',
  negative: 'Negativo',
};

function getDirection(item: Transcript): Direction {
  return item.call.direction === 'inbound' ? 'inbound' : 'outbound';
}

export default function TranscriptsPage() {
  const [items, setItems] = useState<Transcript[]>([]);
  const [activeDirection, setActiveDirection] = useState<Direction>('inbound');
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
        setSelectedId(data.find((item) => getDirection(item) === 'inbound')?.id || null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el historial.');
      })
      .finally(() => setLoading(false));
  }, []);

  const itemsByDirection = useMemo(() => ({
    inbound: items.filter((item) => getDirection(item) === 'inbound'),
    outbound: items.filter((item) => getDirection(item) === 'outbound'),
  }), [items]);

  const filteredItems = itemsByDirection[activeDirection];
  const selected = filteredItems.find((item) => item.id === selectedId);
  const directionLabel = activeDirection === 'inbound' ? 'entrantes' : 'salientes';

  function changeDirection(direction: Direction) {
    setActiveDirection(direction);
    setSelectedId(itemsByDirection[direction][0]?.id || null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Transcripciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conversaciones completas, grabaciones y análisis automático.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Tipo de llamada">
        {[
          { direction: 'inbound' as const, label: 'Llamadas entrantes', icon: PhoneIncoming, count: itemsByDirection.inbound.length },
          { direction: 'outbound' as const, label: 'Llamadas salientes', icon: PhoneOutgoing, count: itemsByDirection.outbound.length },
        ].map(({ direction, label, icon: Icon, count }) => {
          const selectedDirection = activeDirection === direction;
          return <button
            key={direction}
            type="button"
            aria-pressed={selectedDirection}
            onClick={() => changeDirection(direction)}
            className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-colors ${
              selectedDirection
                ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-[#3b82f6]/50 hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon size={20} className={selectedDirection ? 'text-[#3b82f6]' : ''} />
              <span className="font-semibold">{label}</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              selectedDirection ? 'bg-[#3b82f6] text-white' : 'bg-muted text-muted-foreground'
            }`}>{count}</span>
          </button>;
        })}
      </div>

      <div className="grid min-h-[620px] gap-6 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader><CardTitle>Transcripciones {directionLabel}</CardTitle></CardHeader>
          <CardContent className="p-2">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
            ) : error ? (
              <p className="p-6 text-sm text-red-400">{error}</p>
            ) : !filteredItems.length ? (
              <p className="p-6 text-sm text-muted-foreground">Todavía no hay llamadas {directionLabel} registradas.</p>
            ) : filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`mb-1 w-full rounded-lg border p-4 text-left transition ${
                  selectedId === item.id
                    ? 'border-[#3b82f6]/35 bg-[#3b82f6]/8'
                    : 'border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {item.call.contact?.fullName || (activeDirection === 'inbound' ? 'Llamada entrante' : 'Contacto')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.call.contact?.company || item.call.contact?.phone}
                    </p>
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
                  <CardTitle>
                    {selected.call.contact?.fullName || (activeDirection === 'inbound' ? 'Llamada entrante' : 'Contacto')}
                  </CardTitle>
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
                    <p className="mt-1 font-medium text-foreground">
                      {sentimentLabel[selected.sentiment] || selected.sentiment}
                    </p>
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare size={18} /> Conversación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.fullTranscript.length ? selected.fullTranscript.map((turn, index) => (
                  <div key={index} className={`flex gap-3 ${turn.role === 'agent' ? '' : 'flex-row-reverse'}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      turn.role === 'agent'
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    }`}>
                      {turn.role === 'agent' ? <Bot size={15} /> : <User size={15} />}
                    </span>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      turn.role === 'agent'
                        ? 'rounded-tl-sm bg-background text-muted-foreground'
                        : 'rounded-tr-sm bg-blue-500/10 text-blue-900 dark:text-blue-100'
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
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay una transcripción {activeDirection === 'inbound' ? 'entrante' : 'saliente'} para abrir.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
