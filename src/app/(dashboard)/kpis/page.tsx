'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, DollarSign, Target, Timer } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

type Kpis = {
  summary: { callsMade: number; callsAnswered: number; conversations: number; meetingsBooked: number; minutesTalked: number; totalCostUsd: number; costPerMeeting: number; contactRate: number; closeRate: number };
  daily: { date: string; meetingsBooked: number; costUsd: number; costPerMeeting: number }[];
  outcomes: { name: string; value: number; color: string }[];
  heatmap: { day: number; hour: number; value: number }[];
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

export default function KPIsPage() {
  const [data, setData] = useState<Kpis | null>(null);
  useEffect(() => { fetch('/api/kpis', { cache: 'no-store' }).then((res) => res.json()).then(setData); }, []);
  if (!data) return <div className="grid min-h-[420px] place-items-center text-sm text-zinc-500">Calculando métricas…</div>;
  const { summary } = data;
  const maxHeat = Math.max(1, ...data.heatmap.map((item) => item.value));

  return <div className="space-y-7">
    <div><h1 className="text-3xl font-extrabold text-white">Métricas & KPIs</h1><p className="mt-1 text-sm text-zinc-400">Rendimiento comercial, conversión y costos de telefonía.</p></div>
    <Card className="relative overflow-hidden border-[#3b82f6]/25 bg-gradient-to-br from-[#111d33] to-[#111823]"><div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#3b82f6]/10 blur-3xl" /><CardContent className="relative flex flex-col justify-between gap-6 p-8 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3b82f6]">Métrica principal</p><p className="mt-3 text-sm text-zinc-400">Costo por reunión agendada</p><p className="mt-1 text-5xl font-black tracking-tight text-white">{money.format(summary.costPerMeeting)}</p></div><div className="rounded-xl border border-white/10 bg-black/15 px-5 py-4 text-right"><p className="text-xs text-zinc-500">Retorno operativo</p><p className="mt-1 text-lg font-semibold text-white">{summary.meetingsBooked} reuniones</p><p className="text-xs text-zinc-400">con {money.format(summary.totalCostUsd)} invertidos</p></div></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: 'Reuniones', value: summary.meetingsBooked, helper: `${summary.closeRate.toFixed(1)}% de cierre`, icon: CalendarCheck, color: 'text-[#3b82f6]' },
      { label: 'Minutos hablados', value: summary.minutesTalked.toFixed(1), helper: `${summary.callsAnswered} llamadas atendidas`, icon: Timer, color: 'text-blue-300' },
      { label: 'Costo total Telnyx', value: money.format(summary.totalCostUsd), helper: `${summary.callsMade} llamadas realizadas`, icon: DollarSign, color: 'text-amber-300' },
      { label: 'Tasa de contacto', value: `${summary.contactRate.toFixed(1)}%`, helper: `${summary.conversations} conversaciones`, icon: Target, color: 'text-purple-300' },
    ].map(({ label, value, helper, icon: Icon, color }) => <Card key={label}><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><Icon size={18} className={color} /></div><p className="mt-4 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-zinc-500">{helper}</p></CardContent></Card>)}</div>
    <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
      <Card><CardHeader><CardTitle>Costo por reunión</CardTitle><CardDescription>Evolución diaria de la eficiencia de la campaña.</CardDescription></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.daily}><defs><linearGradient id="kpiBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#1f293d" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} stroke="#71717a" fontSize={11}/><YAxis stroke="#71717a" fontSize={11} tickFormatter={(value) => `$${value}`}/><Tooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f293d', borderRadius: 10 }} formatter={(value) => money.format(Number(value))}/><Area type="monotone" dataKey="costPerMeeting" stroke="#3b82f6" strokeWidth={2} fill="url(#kpiBlue)" /></AreaChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader><CardTitle>Resultados de llamadas</CardTitle><CardDescription>Distribución del resultado final.</CardDescription></CardHeader><CardContent><div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.outcomes} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>{data.outcomes.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f293d', borderRadius: 10 }}/></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2">{data.outcomes.map((item) => <div key={item.name} className="flex items-center gap-2 text-xs text-zinc-400"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name} <span className="ml-auto font-mono text-zinc-200">{item.value}</span></div>)}</div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Mejores horarios para llamar</CardTitle><CardDescription>Intensidad de conversaciones por día y hora.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><div className="grid min-w-[720px] grid-cols-[48px_repeat(9,1fr)] gap-2"><div />{Array.from({ length: 9 }, (_, index) => <div key={index} className="text-center text-[11px] text-zinc-500">{index + 9}:00</div>)}{days.map((day, dayIndex) => <div className="contents" key={day}><div className="flex items-center text-xs text-zinc-400">{day}</div>{Array.from({ length: 9 }, (_, hourIndex) => { const item = data.heatmap.find((cell) => cell.day === dayIndex && cell.hour === hourIndex + 9); const opacity = 0.08 + ((item?.value || 0) / maxHeat) * 0.82; return <div key={hourIndex} title={`${item?.value || 0} conversaciones`} className="h-9 rounded-md border border-[#3b82f6]/10" style={{ backgroundColor: `rgba(59,130,246,${opacity})` }} />; })}</div>)}</div></div></CardContent></Card>
  </div>;
}
