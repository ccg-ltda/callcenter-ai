'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Phone, Calendar, Building, Loader2, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Input } from '@/components/ui';
import Link from 'next/link';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',  color: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
  calling:   { label: 'Llamando',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  answered:  { label: 'Contestó',   color: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/25' },
  no_answer: { label: 'No contestó', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  scheduled: { label: 'Reunión',    color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  failed:    { label: 'Error',      color: 'text-red-400 bg-red-500/10 border-red-500/25' },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
        <h1 className="text-3xl font-extrabold text-white">Contactos</h1>
        <p className="text-zinc-400 text-sm mt-1">Base de datos global de contactos de todas las campañas.</p>
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
                statusFilter === status ? info.color : 'text-zinc-500 border-[#1f293d] bg-transparent hover:text-zinc-300'
              }`}
            >
              {info.label}
              <span className={`font-mono font-bold ${statusFilter === status ? '' : 'text-zinc-600'}`}>{count}</span>
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
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
              <Input
                placeholder="Buscar nombre, teléfono..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Users size={32} className="text-zinc-600" />
              <p className="text-sm text-zinc-500">
                {contacts.length === 0 
                  ? 'No hay contactos. Importa desde el detalle de una campaña.'
                  : 'No hay contactos con los filtros seleccionados.'}
              </p>
            </div>
          ) : (
            <div className="border-t border-[#1f293d]/50 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#111823]">
                  <tr>
                    <th className="text-left p-4 text-zinc-400 font-semibold uppercase tracking-wider">Nombre</th>
                    <th className="text-left p-4 text-zinc-400 font-semibold uppercase tracking-wider">Teléfono</th>
                    <th className="text-left p-4 text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">Empresa</th>
                    <th className="text-left p-4 text-zinc-400 font-semibold uppercase tracking-wider">Estado</th>
                    <th className="text-left p-4 text-zinc-400 font-semibold uppercase tracking-wider hidden lg:table-cell">Campaña</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f293d]/50">
                  {filtered.map((c, i) => {
                    const st = STATUS_MAP[c.status] || { label: c.status, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
                    return (
                      <tr key={c.id || i} className="hover:bg-[#111823]/50 transition-colors">
                        <td className="p-4 text-zinc-200 font-medium">{c.fullName}</td>
                        <td className="p-4 font-mono text-zinc-400">
                          <a href={`tel:${c.phone}`} className="hover:text-[#3b82f6] transition-colors flex items-center gap-1.5">
                            <Phone size={11} /> {c.phone}
                          </a>
                        </td>
                        <td className="p-4 text-zinc-500 hidden md:table-cell">
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
                              className="text-zinc-400 hover:text-[#3b82f6] text-[11px] font-mono underline-offset-2 hover:underline transition-colors"
                            >
                              {c.campaignId}
                            </Link>
                          ) : '—'}
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
