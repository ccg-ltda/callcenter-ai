'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Compass, Plus, Rocket, ChevronRight, MoreHorizontal,
  PhoneCall, CalendarCheck, DollarSign, Users, Loader2,
  PauseCircle, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft:    { label: 'Borrador', color: 'text-muted-foreground bg-muted/50 border-zinc-700/50', icon: Clock },
  active:   { label: 'Activa', color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25', icon: Rocket },
  paused:   { label: 'Pausada', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', icon: PauseCircle },
  finished: { label: 'Finalizada', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25', icon: CheckCircle2 },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);

  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (!res.ok) throw new Error('Error al cargar campañas');
      const data = await res.json();
      setCampaigns(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCampaigns(); }, []);

  const handleLaunch = async (id: string) => {
    setLaunching(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al lanzar');
      alert(data.message);
      loadCampaigns();
    } catch (e: any) {
      alert(e.message || 'Error al lanzar la campaña');
    } finally {
      setLaunching(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">Campañas</h1>
          <p className="text-muted-foreground text-sm mt-1">Administra y lanza tus campañas de llamadas salientes.</p>
        </div>
        <Link href="/campaigns/new">
          <Button className="flex items-center gap-2">
            <Plus size={18} /> Nueva Campaña
          </Button>
        </Link>
      </div>

      {/* Campaigns list */}
      {campaigns.length === 0 ? (
        <Card className="border-dashed border-border bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center">
              <Compass size={32} />
            </div>
            <div className="max-w-sm space-y-2">
              <h3 className="text-lg font-semibold text-foreground">No hay campañas creadas</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crea tu primera campaña, asígnale un agente de voz, sube tus contactos y lanza las llamadas.
              </p>
            </div>
            <Link href="/campaigns/new">
              <Button className="flex items-center gap-2">
                <Plus size={16} /> Crear primera campaña
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((camp) => {
            const statusInfo = STATUS_MAP[camp.status] || STATUS_MAP.draft;
            const StatusIcon = statusInfo.icon;
            const contactRate = camp.totalContacts > 0
              ? Math.round((camp.callsMade / camp.totalContacts) * 100)
              : 0;
            const costPerMeeting = camp.meetingsBooked > 0
              ? (camp.totalCostUsd / camp.meetingsBooked).toFixed(2)
              : '—';

            return (
              <Card key={camp.id} className="hover:border-[#3b82f6]/20 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: name + status */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-foreground">{camp.name}</h3>
                        <span className={`flex items-center gap-1 text-[11px] font-semibold font-mono px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                          <StatusIcon size={11} />
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Creada {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString('es-AR') : '—'}
                        {camp.launchedAt && ` · Lanzada ${new Date(camp.launchedAt).toLocaleDateString('es-AR')}`}
                      </p>
                    </div>

                    {/* Middle: KPI pills */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-background border border-border/50 px-3 py-1.5 rounded-lg">
                        <Users size={13} className="text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">{camp.totalContacts}</span>
                        <span className="text-xs text-muted-foreground">contactos</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-background border border-border/50 px-3 py-1.5 rounded-lg">
                        <PhoneCall size={13} className="text-blue-400" />
                        <span className="text-xs font-semibold text-foreground">{camp.callsMade}</span>
                        <span className="text-xs text-muted-foreground">llamadas ({contactRate}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-background border border-border/50 px-3 py-1.5 rounded-lg">
                        <CalendarCheck size={13} className="text-[#3b82f6]" />
                        <span className="text-xs font-semibold text-foreground">{camp.meetingsBooked}</span>
                        <span className="text-xs text-muted-foreground">reuniones</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-background border border-border/50 px-3 py-1.5 rounded-lg">
                        <DollarSign size={13} className="text-amber-400" />
                        <span className="text-xs font-semibold text-foreground">${costPerMeeting}</span>
                        <span className="text-xs text-muted-foreground">/ reunión</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/campaigns/${camp.id}`}>
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          Ver detalles <ChevronRight size={14} />
                        </Button>
                      </Link>
                      {(camp.status === 'draft' || camp.status === 'paused') && (
                        <Button
                          size="sm"
                          onClick={() => handleLaunch(camp.id)}
                          disabled={launching === camp.id}
                          className="flex items-center gap-1.5"
                        >
                          {launching === camp.id ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Rocket size={14} />
                          )}
                          Lanzar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {camp.totalContacts > 0 && (
                    <div className="mt-5 space-y-1.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Progreso de llamadas</span>
                        <span>{camp.callsMade}/{camp.totalContacts}</span>
                      </div>
                      <div className="h-1.5 w-full bg-background rounded-full border border-border/30">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] transition-all duration-500"
                          style={{ width: `${contactRate}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

