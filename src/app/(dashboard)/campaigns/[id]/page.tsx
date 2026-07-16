'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Rocket, Users, PhoneCall, CalendarCheck, DollarSign,
  Upload, Loader2, PauseCircle, CheckCircle2, Clock, Bot
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import CSVImporter from '@/components/CSVImporter';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Borrador', color: 'text-zinc-400 bg-zinc-800/50 border-zinc-700' },
  active:   { label: 'Activa',   color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25' },
  paused:   { label: 'Pausada',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  finished: { label: 'Finalizada', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
};

const CONTACT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',  color: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
  calling:   { label: 'Llamando',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  answered:  { label: 'Contestó',   color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25' },
  no_answer: { label: 'No contestó', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  scheduled: { label: 'Reunión agendada', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  failed:    { label: 'Error',      color: 'text-red-400 bg-red-500/10 border-red-500/25' },
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = async () => {
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
  };

  useEffect(() => { if (id) loadData(); }, [id]);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al lanzar');
      alert(data.message);
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLaunching(false);
    }
  };

  const handleImportComplete = (count: number) => {
    setShowImporter(false);
    loadData(); // Reload contacts
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
    </div>
  );

  if (!campaign) return (
    <div className="text-center py-20 text-zinc-500">Campaña no encontrada.</div>
  );

  const statusInfo = STATUS_MAP[campaign.status] || STATUS_MAP.draft;
  const filteredContacts = statusFilter === 'all'
    ? contacts
    : contacts.filter(c => c.status === statusFilter);

  const contactRate = campaign.totalContacts > 0
    ? Math.round((campaign.callsMade / campaign.totalContacts) * 100)
    : 0;

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
              <h1 className="text-2xl font-extrabold text-white">{campaign.name}</h1>
              <span className={`text-[11px] font-semibold font-mono px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">
              Creada {new Date(campaign.createdAt).toLocaleDateString('es-AR')}
              {campaign.launchedAt && ` · Lanzada ${new Date(campaign.launchedAt).toLocaleDateString('es-AR')}`}
            </p>
          </div>
        </div>

        {(campaign.status === 'draft' || campaign.status === 'paused') && contacts.length > 0 && (
          <Button onClick={handleLaunch} disabled={launching} className="flex items-center gap-2">
            {launching ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
            Lanzar Campaña
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Contactos', value: campaign.totalContacts || contacts.length, icon: Users, color: 'text-zinc-400' },
          { label: 'Llamadas', value: campaign.callsMade, icon: PhoneCall, color: 'text-blue-400' },
          { label: 'Reuniones', value: campaign.meetingsBooked, icon: CalendarCheck, color: 'text-[#3b82f6]' },
          { label: 'Costo total', value: `$${(campaign.totalCostUsd || 0).toFixed(2)}`, icon: DollarSign, color: 'text-amber-400' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider block">{kpi.label}</span>
                  <span className="text-2xl font-bold text-white mt-1 block">{kpi.value}</span>
                </div>
                <div className={`p-2 rounded-lg bg-zinc-800/50 ${kpi.color}`}>
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
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Progreso de campaña</span>
            <span className="font-mono">{campaign.callsMade}/{campaign.totalContacts} llamadas ({contactRate}%)</span>
          </div>
          <div className="h-2 w-full bg-[#0b0f14] rounded-full border border-[#1f293d]/30">
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
            <div className="border border-[#1f293d] rounded-xl p-5 bg-[#0b0f14]/30">
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
                      : 'border-[#1f293d] text-zinc-400 hover:text-white hover:border-zinc-600'
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
              <Users size={32} className="text-zinc-600" />
              <p className="text-sm text-zinc-500">
                No hay contactos importados aún. Usa el botón <strong className="text-zinc-300">Importar CSV</strong> para cargar tu lista.
              </p>
            </div>
          ) : (
            <div className="border border-[#1f293d] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#111823]">
                  <tr>
                    <th className="text-left p-3 text-zinc-400 font-semibold uppercase tracking-wider">Nombre</th>
                    <th className="text-left p-3 text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                    <th className="text-left p-3 text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">Empresa</th>
                    <th className="text-left p-3 text-zinc-400 font-semibold uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f293d]/50">
                  {filteredContacts.map((c) => {
                    const st = CONTACT_STATUS_MAP[c.status] || { label: c.status, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
                    return (
                      <tr key={c.id} className="hover:bg-[#111823]/50 transition-colors">
                        <td className="p-3 text-zinc-200 font-medium">{c.fullName}</td>
                        <td className="p-3 font-mono text-zinc-400 hidden sm:table-cell">{c.phone}</td>
                        <td className="p-3 text-zinc-500 hidden md:table-cell">{c.company || '—'}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-xs text-zinc-500">
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
