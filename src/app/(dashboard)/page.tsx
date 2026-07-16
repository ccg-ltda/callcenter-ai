'use client';

import { useState, useEffect } from 'react';
import { 
  Phone, 
  Percent, 
  Calendar as CalendarIcon, 
  DollarSign, 
  ArrowRight, 
  Clock, 
  Bot, 
  AlertCircle 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import Link from 'next/link';

export default function DashboardPage() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock data for the AreaChart (Meetings per day)
  const chartData = [
    { name: 'Lun', reuniones: 2 },
    { name: 'Mar', reuniones: 5 },
    { name: 'Mié', reuniones: 3 },
    { name: 'Jue', reuniones: 8 },
    { name: 'Vie', reuniones: 6 },
    { name: 'Sáb', reuniones: 0 },
    { name: 'Dom', reuniones: 1 },
  ];

  // Mock upcoming meetings
  const upcomingMeetings = [
    { id: 1, contact: 'Juan Pérez', phone: '+54 9 11 5555 1234', time: '14:30', date: 'Hoy', company: 'Initech', status: 'scheduled' },
    { id: 2, contact: 'María Gigli', phone: '+54 9 341 555 6789', time: '10:00', date: 'Mañana', company: 'Globex', status: 'scheduled' },
    { id: 3, contact: 'Carlos Gómez', phone: '+34 600 555 123', time: '16:00', date: '18 de Julio', company: 'Acme Corp', status: 'scheduled' },
  ];

  useEffect(() => {
    async function checkSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Error checks settings');
        const data = await res.json();
        
        // If settings has no phone number or api key, consider not onboarded
        if (!data || !data.telnyxApiKeyConfigured || !data.telnyxPhoneNumber) {
          setIsOnboarded(false);
        } else {
          setIsOnboarded(true);
        }
      } catch (error) {
        console.error('Error loading onboarding settings:', error);
        setIsOnboarded(true); // Default to show dashboard to prevent locking
      } finally {
        setLoading(false);
      }
    }
    checkSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-zinc-500 font-mono text-sm">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Onboarding Banner Warning */}
      {isOnboarded === false && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-white text-sm">Configuración de Campaña Incompleta</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Aún no has completado el onboarding inicial para configurar tus credenciales de Telnyx, 
                comprar tu número saliente o crear tu primer agente de IA. Las campañas de llamadas no se iniciarán.
              </p>
            </div>
          </div>
          <Link href="/onboarding" className="w-full md:w-auto shrink-0">
            <Button size="sm" className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-[#0b0f14]">
              Completar Onboarding <ArrowRight size={14} className="ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Rendimiento general y próximas reuniones de tus agentes de IA.</p>
        </div>
        <Link href="/campaigns">
          <Button className="flex items-center gap-2">
            Crear Campaña <ArrowRight size={16} />
          </Button>
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Llamadas Realizadas', value: '148', desc: '+12% respecto a ayer', icon: Phone, color: 'text-blue-400' },
          { title: 'Tasa de Contacto', value: '64.2%', desc: '+2.4% promedio', icon: Percent, color: 'text-[#3b82f6]' },
          { title: 'Reuniones Agendadas', value: '25', desc: 'Objetivo de campaña: 50', icon: CalendarIcon, color: 'text-purple-400' },
          { title: 'Costo por Reunión', value: '$1.42 USD', desc: 'Presupuesto optimizado', icon: DollarSign, color: 'text-amber-400' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className="hover:border-[#3b82f6]/30 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{card.title}</span>
                  <div className={`p-1.5 rounded-lg bg-zinc-800/50 ${card.color}`}>
                    <Icon size={16} />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-white tracking-tight">{card.value}</span>
                  <span className="text-xs text-zinc-400 block mt-1">{card.desc}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts & Conversion Funnel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reuniones Agendadas por Día</CardTitle>
            <CardDescription>Seguimiento de agendamientos exitosos durante la última semana.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReuniones" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d/30" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111823', borderColor: '#1f293d', borderRadius: '8px', color: '#fff' }}
                  labelStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="reuniones" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorReuniones)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Embudo de Conversión</CardTitle>
            <CardDescription>Eficiencia de llamadas en vivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Marcadas (Total)', count: 230, pct: 100, color: 'bg-zinc-700' },
              { label: 'Atendidas (Contacto)', count: 148, pct: 64.2, color: 'bg-blue-500' },
              { label: 'Conversación (Interés)', count: 68, pct: 29.5, color: 'bg-purple-500' },
              { label: 'Reunión (Éxito)', count: 25, pct: 10.8, color: 'bg-[#3b82f6]' },
            ].map((step, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-zinc-300">{step.label}</span>
                  <span className="font-mono text-zinc-400">
                    {step.count} ({step.pct}%)
                  </span>
                </div>
                <div className="h-3 w-full bg-[#0b0f14] rounded-full overflow-hidden border border-[#1f293d]/50">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${step.color}`} 
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Meetings & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Next Meetings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximas Reuniones</CardTitle>
            <CardDescription>Reuniones confirmadas y agendadas en Google Calendar.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#1f293d]/50">
              {upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="p-5 flex items-center justify-between hover:bg-[#1f293d]/10 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                      <CalendarIcon size={18} />
                    </div>
                    <div>
                      <span className="font-semibold text-white block text-sm">{meeting.contact}</span>
                      <span className="text-xs text-zinc-400 block">{meeting.company} • {meeting.phone}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-white block">{meeting.time}</span>
                    <span className="text-xs text-zinc-500 font-mono block">{meeting.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Tips / Call window info */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Agente</CardTitle>
            <CardDescription>Estado de disponibilidad del motor de voz.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0b0f14] border border-[#1f293d]/50">
              <div className="h-9 w-9 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">Horario permitido</span>
                <span className="text-sm font-bold text-white block">10:00 a 18:00</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0b0f14] border border-[#1f293d]/50">
              <div className="h-9 w-9 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">Agente activo</span>
                <span className="text-sm font-bold text-white block">Asistente Agendador</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
