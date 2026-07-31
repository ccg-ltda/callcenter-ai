'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Rocket, Users, PhoneCall, CalendarCheck, DollarSign,
  Upload, Loader2, CheckCircle2, Pencil, RefreshCw, AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import CSVImporter from '@/components/CSVImporter';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Borrador', color: 'text-muted-foreground bg-muted/50 border-zinc-700' },
  active:   { label: 'Activa',   color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25' },
  paused:   { label: 'Pausada',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  finished: { label: 'Finalizada', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
};

const CONTACT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',  color: 'text-muted-foreground bg-muted border-zinc-700' },
  calling:   { label: 'Llamando',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  answered:  { label: 'Contestó',   color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25' },
  no_answer: { label: 'No contestó', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  scheduled: { label: 'Reunión agendada', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  failed:    { label: 'Error',      color: 'text-red-400 bg-red-500/10 border-red-500/25' },
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  interface Campaign {
    name: string;
    status: string;
    totalContacts: number;
    callsMade: number;
    meetingsBooked: number;
    totalCostUsd: number;
    outboundPhoneNumber?: string;
    createdAt: string;
    launchedAt?: string;
  }

  interface Contact {
    id: string;
    fullName: string;
    phone: string;
    company?: string;
    status: string;
    customFields?: { callError?: string };
  }

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [correctingContactId, setCorrectingContactId] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const [campRes, contactsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/contacts?campaignId=${id}`),
      ]);
      const [campData, contactsData] = await Promise.all([campRes.json(), contactsRes.json()]);
      setCampaign(campData);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [id, loadData]);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al lanzar');
      alert(data.message);
      loadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error al lanzar');
    } finally {
      setLaunching(false);
    }
  };

  const handleImportComplete = () => {
    setShowImporter(false);
    loadData(); // Reload contacts
  };

  const handleFinish = async () => {
    const confirmed = window.confirm(
      '¿Finalizar esta campaña? Las llamadas ya iniciadas no se interrumpirán y podrás volver a iniciarla después.'
    );
    if (!confirmed) return;

    setFinishing(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finished', finishedAt: new Date().toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo finalizar la campaña.');
      setCampaign(data.campaign);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'No se pudo finalizar la campaña.');
    } finally {
      setFinishing(false);
    }
  };

  const handleCorrectPhone = async (contact: Contact) => {
    const phone = window.prompt(
      `Corrige el teléfono de ${contact.fullName}. Incluye el código de país:`,
      contact.phone,
    );
    if (!phone || phone === contact.phone) return;

    setCorrectingContactId(contact.id);
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo corregir el teléfono.');
      await loadData();
      alert('Teléfono actualizado. El contacto volvió a estado Pendiente.');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'No se pudo corregir el teléfono.');
    } finally {
      setCorrectingContactId(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
    </div>
  );

  if (!campaign) return (
    <div className="text-center py-20 text-muted-foreground">Campaña no encontrada.</div>
  );

  const statusInfo = STATUS_MAP[campaign.status] || STATUS_MAP.draft;
  const filteredContacts = statusFilter === 'all'
    ? contacts
    : contacts.filter(c => c.status === statusFilter);

  const contactRate = campaign.totalContacts > 0
    ? Math.round((campaign.callsMade / campaign.totalContacts) * 100)
    : 0;
  const failedContacts = contacts.filter((contact) => contact.status === 'failed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-foreground">{campaign.name}</h1>
              <span className={`text-[11px] font-semibold font-mono px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Creada {new Date(campaign.createdAt).toLocaleDateString('es-AR')}
              {campaign.launchedAt && ` · Lanzada ${new Date(campaign.launchedAt).toLocaleDateString('es-AR')}`}
              {campaign.outboundPhoneNumber && ` · Salida ${campaign.outboundPhoneNumber}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(campaign.status === 'draft' || campaign.status === 'paused') && contacts.length > 0 && (
            <Button onClick={handleLaunch} disabled={launching} className="flex items-center gap-2">
              {launching ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
              Lanzar Campaña
            </Button>
          )}
          {campaign.status === 'finished' && contacts.length > 0 && (
            <Button onClick={handleLaunch} disabled={launching} className="flex items-center gap-2">
              {launching ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
              Iniciar nuevamente
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button onClick={handleFinish} disabled={finishing} variant="danger" className="flex items-center gap-2">
              {finishing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Finalizar campaña
            </Button>
          )}
          {failedContacts.length > 0 && (
            <Button onClick={handleLaunch} disabled={launching} variant="outline" className="flex items-center gap-2">
              {launching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Reintentar errores ({failedContacts.length})
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Contactos', value: campaign.totalContacts || contacts.length, icon: Users, color: 'text-muted-foreground' },
          { label: 'Llamadas', value: campaign.callsMade, icon: PhoneCall, color: 'text-blue-400' },
          { label: 'Reuniones', value: campaign.meetingsBooked, icon: CalendarCheck, color: 'text-[#3b82f6]' },
          { label: 'Costo total', value: `$${(campaign.totalCostUsd || 0).toFixed(2)}`, icon: DollarSign, color: 'text-amber-400' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">{kpi.label}</span>
                  <span className="text-2xl font-bold text-foreground mt-1 block">{kpi.value}</span>
                </div>
                <div className={`p-2 rounded-lg bg-muted/50 ${kpi.color}`}>
                  <Icon size={18} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Progress bar */}
      {campaign.totalContacts > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progreso de campaña</span>
            <span className="font-mono">{campaign.callsMade}/{campaign.totalContacts} llamadas ({contactRate}%)</span>
          </div>
          <div className="h-2 w-full bg-background rounded-full border border-border/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] transition-all duration-700"
              style={{ width: `${Math.min(contactRate, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Contacts section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contactos ({contacts.length})</CardTitle>
              <CardDescription>Lista de contactos importados para esta campaña.</CardDescription>
            </div>
            <Button onClick={() => setShowImporter(!showImporter)} variant="outline" size="sm" className="flex items-center gap-2">
              <Upload size={15} />
              {showImporter ? 'Ocultar importador' : 'Importar CSV'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CSV Importer */}
          {showImporter && (
            <div className="border border-border rounded-xl p-5 bg-background/30">
              <CSVImporter campaignId={id} onImportComplete={handleImportComplete} />
            </div>
          )}

          {/* Filter tabs */}
          {contacts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'calling', 'answered', 'scheduled', 'no_answer', 'failed'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    statusFilter === s
                      ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-zinc-600'
                  }`}
                >
                  {s === 'all' ? `Todos (${contacts.length})` : CONTACT_STATUS_MAP[s]?.label}
                </button>
              ))}
            </div>
          )}

          {/* Contacts table */}
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Users size={32} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay contactos importados aún. Usa el botón <strong className="text-muted-foreground">Importar CSV</strong> para cargar tu lista.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">Nombre</th>
                    <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                    <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Empresa</th>
                    <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">Estado</th>
                    <th className="text-right p-3 text-muted-foreground font-semibold uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredContacts.map((c) => {
                    const st = CONTACT_STATUS_MAP[c.status] || { label: c.status, color: 'text-muted-foreground bg-muted border-zinc-700' };
                    return (
                      <tr key={c.id} className="hover:bg-surface/50 transition-colors">
                        <td className="p-3 text-foreground font-medium">{c.fullName}</td>
                        <td className="p-3 font-mono text-muted-foreground hidden sm:table-cell">{c.phone}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{c.company || '—'}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>
                            {st.label}
                          </span>
                          {c.status === 'failed' && c.customFields?.callError && (
                            <p className="mt-1.5 max-w-xs text-[10px] leading-relaxed text-red-400 flex items-start gap-1">
                              <AlertCircle size={11} className="mt-0.5 shrink-0" />
                              {c.customFields.callError}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {c.status === 'failed' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCorrectPhone(c)}
                              disabled={correctingContactId === c.id}
                              className="inline-flex items-center gap-1.5"
                            >
                              {correctingContactId === c.id ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <Pencil size={12} />
                              )}
                              Corregir teléfono
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No hay contactos con el estado seleccionado.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
