'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, format, isSameDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Link2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type Meeting = { id: string; scheduledAt: string; durationMin: number; googleEventId: string | null; status: string; contact: { fullName: string; company?: string; phone: string } };

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connected, setConnected] = useState(false);
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  useEffect(() => {
    const start = weekStart.toISOString(); const end = addDays(weekStart, 7).toISOString();
    fetch(`/api/meetings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: 'no-store' }).then((res) => res.json()).then(setMeetings);
    fetch('/api/settings', { cache: 'no-store' }).then((res) => res.json()).then((data) => setConnected(Boolean(data.googleCalendarConnected)));
  }, [weekStart]);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-extrabold text-foreground">Calendario</h1><p className="mt-1 text-sm text-muted-foreground">Reuniones detectadas y agendadas por los agentes.</p></div><div className="flex items-center gap-2"><span className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs ${connected ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-amber-500/10 text-amber-300'}`}><span className={`h-2 w-2 rounded-full ${connected ? 'bg-[#3b82f6]' : 'bg-amber-400'}`} />{connected ? 'Google Calendar conectado' : 'Google Calendar sin conectar'}</span>{!connected && <a href="/api/google/auth"><Button size="sm"><Link2 size={14} className="mr-2" />Conectar</Button></a>}</div></div>
    <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="capitalize">{format(weekStart, "MMMM 'de' yyyy", { locale: es })}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{meetings.length} reuniones esta semana</p></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, -1))}><ChevronLeft size={17} /></Button><Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Hoy</Button><Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, 1))}><ChevronRight size={17} /></Button></div></CardHeader><CardContent className="p-0"><div className="grid min-w-[880px] grid-cols-7 divide-x divide-border overflow-x-auto">{days.map((day) => {
      const dayMeetings = meetings.filter((meeting) => isSameDay(new Date(meeting.scheduledAt), day));
      const today = isSameDay(day, new Date());
      return <div key={day.toISOString()} className="min-h-[470px]"><div className={`border-b border-border px-4 py-4 text-center ${today ? 'bg-[#3b82f6]/5' : ''}`}><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{format(day, 'EEE', { locale: es })}</p><p className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full font-semibold ${today ? 'bg-[#3b82f6] text-accent-foreground' : 'text-foreground'}`}>{format(day, 'd')}</p></div><div className="space-y-3 p-3">{dayMeetings.map((meeting) => <div key={meeting.id} className="rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/7 p-3"><p className="font-semibold text-foreground">{meeting.contact?.fullName || 'Contacto'}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{meeting.contact?.company || meeting.contact?.phone}</p><div className="mt-3 flex items-center gap-1.5 text-xs text-[#3b82f6]"><Clock size={13} />{format(new Date(meeting.scheduledAt), 'HH:mm')} · {meeting.durationMin} min</div>{meeting.googleEventId && <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><ExternalLink size={11} />Sincronizada</p>}</div>)}{!dayMeetings.length && <div className="py-8 text-center text-[11px] text-muted-foreground">Sin reuniones</div>}</div></div>;
    })}</div></CardContent></Card>
  </div>;
}

