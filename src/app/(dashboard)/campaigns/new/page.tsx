'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Bot } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Label, Select } from '@/components/ui';

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => {
        setAgents(data || []);
        if (data?.length > 0) setAgentId(data[0].id);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert('Por favor ingresa un nombre para la campaña.'); return; }
    setSaving(true);
    try {
      const id = 'camp_' + Date.now();
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: name.trim(), agentId: agentId || null }),
      });
      if (!res.ok) throw new Error('Error al crear campaña');
      const data = await res.json();
      router.push(`/campaigns/${data.campaign?.id || id}`);
    } catch (e: any) {
      alert(e.message || 'Error al crear campaña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-white">Nueva Campaña</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Configura el nombre y agente, luego importarás los contactos.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="campName">Nombre de la Campaña</Label>
              <Input
                id="campName"
                placeholder="Ej. Campaña Inmobiliaria Julio 2026"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentSelect">Agente de Voz</Label>
              {agents.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs">
                  <Bot size={15} />
                  <span>No hay agentes creados. <Link href="/agents" className="underline font-semibold">Crea uno primero.</Link></span>
                </div>
              ) : (
                <Select
                  id="agentSelect"
                  options={agents.map(a => ({ value: a.id, label: `${a.name} (${a.voice})` }))}
                  value={agentId}
                  onChange={e => setAgentId(e.target.value)}
                />
              )}
              <p className="text-[11px] text-zinc-500">El agente de voz será quien realice y conduzca las conversaciones.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Link href="/campaigns">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={saving || agents.length === 0} className="flex items-center gap-2">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Crear Campaña
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
