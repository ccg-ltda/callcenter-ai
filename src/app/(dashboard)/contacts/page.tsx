'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Phone, PhoneCall, Building, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Select } from '@/components/ui';
import Link from 'next/link';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  company?: string | null;
  status: string;
  campaignId?: string | null;
}

interface AgentOption {
  id: string;
  name: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',  color: 'text-muted-foreground bg-muted border-zinc-700' },
  calling:   { label: 'Llamando',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  answered:  { label: 'Contestó',   color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25' },
  no_answer: { label: 'No contestó', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  scheduled: { label: 'Reunión',    color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  failed:    { label: 'Error',      color: 'text-red-400 bg-red-500/10 border-red-500/25' },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [callingContactId, setCallingContactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function loadData() {
      try {
        const [contactsResponse, agentsResponse] = await Promise.all([
          fetch('/api/contacts'),
          fetch('/api/agents'),
        ]);
        const [contactsData, agentsData] = await Promise.all([
          contactsResponse.json(),
          agentsResponse.json(),
        ]);
        if (!contactsResponse.ok) throw new Error(contactsData.error || 'Error al cargar contactos');
        if (!agentsResponse.ok) throw new Error(agentsData.error || 'Error al cargar agentes');
        setContacts(Array.isArray(contactsData) ? contactsData : []);
        setAgents(Array.isArray(agentsData) ? agentsData : []);
        if (agentsData.length > 0) setSelectedAgentId(agentsData[0].id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCall = async (contact: Contact) => {
    if (!selectedAgentId) {
      alert('Primero selecciona un agente para realizar la llamada.');
      return;
    }
    const confirmed = window.confirm(
      `¿Iniciar una llamada real a ${contact.fullName} (${contact.phone})? Esta llamada puede consumir saldo de Telnyx.`
    );
    if (!confirmed) return;

    setCallingContactId(contact.id);
    try {
      const response = await fetch(`/api/contacts/${contact.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al iniciar la llamada');
      setContacts((current) => current.map((item) =>
        item.id === contact.id ? { ...item, status: 'calling' } : item
      ));
      alert(data.message || 'Llamada iniciada.');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error al iniciar la llamada');
    } finally {
      setCallingContactId(null);
    }
  };

  const filtered = contacts.filter(c => {
    const matchesSearch = !search || 
      c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.company?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Contactos</h1>
        <p className="text-muted-foreground text-sm mt-1">Base de datos global de contactos de todas las campañas.</p>
      </div>

      {/* Summary stat pills */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_MAP).map(([status, info]) => {
          const count = contacts.filter(c => c.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                statusFilter === status ? info.color : 'text-muted-foreground border-border bg-transparent hover:text-muted-foreground'
              }`}
            >
              {info.label}
              <span className={`font-mono font-bold ${statusFilter === status ? '' : 'text-muted-foreground'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Todos los Contactos ({filtered.length})</CardTitle>
              <CardDescription>Para importar contactos, hazlo desde el detalle de cada campaña.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Select
                aria-label="Agente para llamadas"
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                options={agents.length > 0
                  ? agents.map((agent) => ({ value: agent.id, label: `Agente: ${agent.name}` }))
                  : [{ value: '', label: 'No hay agentes disponibles' }]}
                disabled={agents.length === 0}
                className="sm:min-w-52"
              />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  placeholder="Buscar nombre, teléfono..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Users size={32} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {contacts.length === 0 
                  ? 'No hay contactos. Importa desde el detalle de una campaña.'
                  : 'No hay contactos con los filtros seleccionados.'}
              </p>
            </div>
          ) : (
            <div className="border-t border-border/50 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left p-4 text-muted-foreground font-semibold uppercase tracking-wider">Nombre</th>
                    <th className="text-left p-4 text-muted-foreground font-semibold uppercase tracking-wider">Teléfono</th>
                    <th className="text-left p-4 text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">Empresa</th>
                    <th className="text-left p-4 text-muted-foreground font-semibold uppercase tracking-wider">Estado</th>
                    <th className="text-left p-4 text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">Campaña</th>
                    <th className="text-right p-4 text-muted-foreground font-semibold uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((c, i) => {
                    const st = STATUS_MAP[c.status] || { label: c.status, color: 'text-muted-foreground bg-muted border-zinc-700' };
                    return (
                      <tr key={c.id || i} className="hover:bg-surface/50 transition-colors">
                        <td className="p-4 text-foreground font-medium">{c.fullName}</td>
                        <td className="p-4 font-mono text-muted-foreground">
                          <a href={`tel:${c.phone}`} className="hover:text-[#3b82f6] transition-colors flex items-center gap-1.5">
                            <Phone size={11} /> {c.phone}
                          </a>
                        </td>
                        <td className="p-4 text-muted-foreground hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            {c.company && <Building size={11} />} {c.company || '—'}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          {c.campaignId ? (
                            <Link
                              href={`/campaigns/${c.campaignId}`}
                              className="text-muted-foreground hover:text-[#3b82f6] text-[11px] font-mono underline-offset-2 hover:underline transition-colors"
                            >
                              {c.campaignId}
                            </Link>
                          ) : '—'}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCall(c)}
                            disabled={!selectedAgentId || callingContactId !== null}
                            className="inline-flex items-center gap-1.5"
                          >
                            {callingContactId === c.id ? (
                              <Loader2 className="animate-spin" size={13} />
                            ) : (
                              <PhoneCall size={13} />
                            )}
                            Llamar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

