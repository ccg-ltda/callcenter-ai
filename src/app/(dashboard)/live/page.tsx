'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, PhoneCall, Radio, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type Call = { id: string; status: string; startedAt: string | null; durationSeconds: number; contact: { fullName: string; phone: string; company?: string } | null };

const labels: Record<string, string> = { queued: 'En cola', ringing: 'Marcando', in_progress: 'En conversación', completed: 'Completada', failed: 'Fallida' };
const colors: Record<string, string> = { queued: 'text-muted-foreground bg-muted/10', ringing: 'text-amber-300 bg-amber-400/10', in_progress: 'text-[#3b82f6] bg-[#3b82f6]/10', completed: 'text-blue-300 bg-blue-400/10', failed: 'text-red-300 bg-red-400/10' };

function elapsed(call: Call, tick: number) {
  if (call.status === 'in_progress' && call.startedAt) return Math.max(0, Math.round((tick - new Date(call.startedAt).getTime()) / 1000));
  return call.durationSeconds || 0;
}

export default function LiveCallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadCalls = useCallback(async () => {
    const response = await fetch('/api/calls', { cache: 'no-store' });
    if (response.ok) setCalls(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCalls);
    const clock = window.setInterval(() => setTick(Date.now()), 1000);
    const poll = window.setInterval(loadCalls, 8000);
    let channel: { unsubscribe: () => void } | undefined;
    if (process.env.NEXT_PUBLIC_USE_MOCK_SERVICES !== 'true') {
      channel = supabase.channel('live-calls').on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, loadCalls).subscribe();
    }
    return () => { window.clearInterval(clock); window.clearInterval(poll); channel?.unsubscribe(); };
  }, [loadCalls]);

  const counts = useMemo(() => ({
    active: calls.filter((call) => ['ringing', 'in_progress'].includes(call.status)).length,
    queued: calls.filter((call) => call.status === 'queued').length,
    completed: calls.filter((call) => call.status === 'completed').length,
  }), [calls]);

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-3xl font-extrabold text-foreground">Llamadas en vivo</h1><p className="mt-1 text-sm text-muted-foreground">Estados sincronizados con Telnyx y Supabase Realtime.</p></div>
      <Button variant="outline" size="sm" onClick={loadCalls}><RefreshCw size={14} className="mr-2" />Actualizar</Button>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[{ label: 'En curso', value: counts.active, icon: Radio, color: 'text-[#3b82f6]' }, { label: 'En cola', value: counts.queued, icon: Clock3, color: 'text-amber-300' }, { label: 'Completadas', value: counts.completed, icon: PhoneCall, color: 'text-blue-300' }].map(({ label, value, icon: Icon, color }) =>
        <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-foreground">{value}</p></div><Icon className={color} size={24} /></CardContent></Card>)}
    </div>
    <Card>
      <CardHeader><CardTitle>Cola de llamadas</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Sincronizando llamadas…</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-4">Contacto</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Duración</th><th className="px-6 py-4">Actividad</th></tr></thead><tbody className="divide-y divide-border/60">
          {calls.map((call) => <tr key={call.id} className="hover:bg-white/[0.02]"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]"><Users size={16} /></span><div><p className="font-medium text-foreground">{call.contact?.fullName || 'Contacto'}</p><p className="text-xs text-muted-foreground">{call.contact?.company || call.contact?.phone}</p></div></div></td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[call.status] || colors.queued}`}>{labels[call.status] || call.status}</span></td><td className="px-6 py-4 font-mono text-muted-foreground">{String(Math.floor(elapsed(call, tick) / 60)).padStart(2, '0')}:{String(elapsed(call, tick) % 60).padStart(2, '0')}</td><td className="px-6 py-4"><div className={`flex h-7 items-end gap-1 ${call.status === 'in_progress' ? '' : 'opacity-30'}`}>{[9, 17, 12, 22, 14, 19, 8, 15].map((h, i) => <span key={i} className="w-1 rounded-full bg-[#3b82f6] animate-pulse" style={{ height: h, animationDelay: `${i * 90}ms` }} />)}</div></td></tr>)}
        </tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
}

