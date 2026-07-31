'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Bot } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, Button, Input, Label, Select } from '@/components/ui';

interface AgentOption {
  id: string;
  name: string;
  voice: string;
}

interface PhoneOption {
  phoneNumber: string;
  status: string;
  isDefaultOutbound: boolean;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneOption[]>([]);
  const [outboundPhoneNumber, setOutboundPhoneNumber] = useState('');
  const [migrationRequired, setMigrationRequired] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then((response) => response.json()),
      fetch('/api/telnyx/numbers/owned').then((response) => response.json()),
    ])
      .then(([agentData, numberData]) => {
        setAgents(agentData || []);
        if (agentData?.length > 0) setAgentId(agentData[0].id);
        const activeNumbers = Array.isArray(numberData?.numbers)
          ? numberData.numbers.filter((number: PhoneOption) => number.status === 'active')
          : [];
        setPhoneNumbers(activeNumbers);
        setMigrationRequired(Boolean(numberData?.migrationRequired));
        setOutboundPhoneNumber(
          numberData?.defaultOutboundNumber || activeNumbers[0]?.phoneNumber || '',
        );
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
        body: JSON.stringify({
          id,
          name: name.trim(),
          agentId: agentId || null,
          outboundPhoneNumber: outboundPhoneNumber || null,
        }),
      });
      if (!res.ok) throw new Error('Error al crear campaña');
      const data = await res.json();
      router.push(`/campaigns/${data.campaign?.id || id}`);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error al crear campaña');
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
          <h1 className="text-3xl font-extrabold text-foreground">Nueva Campaña</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configura el nombre y agente, luego importarás los contactos.</p>
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
              <Label htmlFor="outboundNumber">Número para llamadas salientes</Label>
              {phoneNumbers.length ? (
                <Select
                  id="outboundNumber"
                  options={phoneNumbers.map((number) => ({
                    value: number.phoneNumber,
                    label: `${number.phoneNumber}${number.isDefaultOutbound ? ' (predeterminado)' : ''}`,
                  }))}
                  value={outboundPhoneNumber}
                  onChange={(event) => setOutboundPhoneNumber(event.target.value)}
                />
              ) : (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                  Compra o sincroniza un número Telnyx antes de crear campañas.
                </p>
              )}
              {migrationRequired && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                  Aplica la migración 0003_multi_number_inventory.sql antes de crear campañas con múltiples líneas.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Esta campaña conservará esta línea aunque luego cambies el número predeterminado.
              </p>
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
              <p className="text-[11px] text-muted-foreground">El agente de voz será quien realice y conduzca las conversaciones.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Link href="/campaigns">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={saving || agents.length === 0 || phoneNumbers.length === 0 || migrationRequired} className="flex items-center gap-2">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Crear Campaña
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

