'use client';

import { useState, useEffect } from 'react';
import { Plus, PhoneCall, Loader2, Play, AlertCircle } from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  Button, 
  Input, 
  Label, 
  Select, 
  Textarea 
} from '@/components/ui';

interface Agent {
  id: string;
  name: string;
  voice: string;
  script: string;
  goal?: string;
  meetingDurationMin?: number;
}

export default function AgentsPage() {
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calling, setCalling] = useState(false);

  // Form State
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentVoice, setAgentVoice] = useState('telnyx_voice_es_female_1');
  const [agentScript, setAgentScript] = useState('');
  const [agentGoal, setAgentGoal] = useState('agendar_reunion');
  const [meetingDuration, setMeetingDuration] = useState(15);

  // Test Call State
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [selectedAgentForTest, setSelectedAgentForTest] = useState('');

  const voiceOptions = [
    { value: 'telnyx_voice_es_female_1', label: 'Español - Femenina (Melina)' },
    { value: 'telnyx_voice_es_male_1', label: 'Español - Masculino (Mateo)' },
    { value: 'telnyx_voice_en_female_1', label: 'Inglés - Femenina (Alice)' },
    { value: 'telnyx_voice_en_male_1', label: 'Inglés - Masculino (Bob)' },
  ];

  // Fetch agents list
  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Error al cargar agentes');
      const data = await res.json();
      setAgentsList(data || []);
      if (data.length > 0) {
        setSelectedAgentForTest(data[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAgents(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Handle Form Submit to create/edit Agent
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName || !agentScript) {
      alert('Por favor, completa los campos requeridos (Nombre y Guion).');
      return;
    }

    setSaving(true);
    const id = agentId || 'agent_' + Math.floor(Math.random() * 1000000);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: agentName,
          voice: agentVoice,
          script: agentScript,
          goal: agentGoal,
          meetingDurationMin: Number(meetingDuration),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Error al guardar el agente');
      alert('Agente guardado exitosamente');
      
      // Reset form
      setAgentId('');
      setAgentName('');
      setAgentVoice('telnyx_voice_es_female_1');
      setAgentScript('');
      setAgentGoal('agendar_reunion');
      setMeetingDuration(15);
      
      // Reload list
      loadAgents();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Select agent to edit
  const handleEdit = (agent: Agent) => {
    setAgentId(agent.id);
    setAgentName(agent.name);
    setAgentVoice(agent.voice);
    setAgentScript(agent.script);
    setAgentGoal(agent.goal || 'agendar_reunion');
    setMeetingDuration(agent.meetingDurationMin || 15);
  };

  // Trigger test call
  const handleTestCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneNumber) {
      alert('Ingresa un número de teléfono de destino.');
      return;
    }
    if (!selectedAgentForTest) {
      alert('Selecciona un agente para realizar la prueba.');
      return;
    }

    setCalling(true);
    try {
      const res = await fetch('/api/agents/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber,
          agentId: selectedAgentForTest,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar la llamada');
      alert(`Llamada iniciada con éxito. ${data.message}`);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error al disparar llamada');
    } finally {
      setCalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Agentes de Voz de IA</h1>
        <p className="text-muted-foreground mt-1 text-sm">Configura la voz, objetivos de venta y el guion (prompt de sistema) de tus agentes conversacionales.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Agent List & Testing Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* List Card */}
          <Card>
            <CardHeader>
              <CardTitle>Agentes Activos</CardTitle>
              <CardDescription>Agentes configurados en tu cuenta listos para realizar llamadas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {agentsList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No hay agentes creados. Utiliza el formulario para crear el primero.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {agentsList.map((agent) => (
                    <div 
                      key={agent.id} 
                      className="p-5 flex items-start justify-between hover:bg-surface-2/10 transition-colors"
                    >
                      <div className="space-y-1.5 max-w-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{agent.name}</span>
                          <span className="text-[10px] bg-[#3b82f6]/10 text-[#3b82f6] px-2 py-0.5 rounded font-semibold font-mono">
                            {agent.goal === 'agendar_reunion' ? 'Agendar Reunión' : agent.goal}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          Voz: {voiceOptions.find(o => o.value === agent.voice)?.label || agent.voice} • Duración: {agent.meetingDurationMin || 15} min
                        </p>
                        <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">
                          &ldquo;{agent.script}&rdquo;
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleEdit(agent)}
                      >
                        Editar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Call Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                  <PhoneCall size={20} />
                </div>
                <div>
                  <CardTitle>Probar Llamada del Agente</CardTitle>
                  <CardDescription>Dispara una llamada real (o simulación) al teléfono de prueba para evaluar la voz.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTestCall} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="testAgent">Seleccionar Agente</Label>
                    <Select
                      id="testAgent"
                      options={agentsList.map(a => ({ value: a.id, label: a.name }))}
                      value={selectedAgentForTest}
                      onChange={(e) => setSelectedAgentForTest(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Número de Teléfono Destinatario</Label>
                    <Input
                      id="testPhone"
                      type="text"
                      placeholder="+54 9 11 5555 1234"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-start gap-2 text-muted-foreground text-[11px] leading-relaxed py-1">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-[#3b82f6]" />
                  <span>
                    El número de destino debe incluir el código de país; puede contener espacios, guiones o paréntesis. En modo simulación, 
                    se simularán los webhooks y las grabaciones en el dashboard sin consumir saldo de Telnyx.
                  </span>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={calling || agentsList.length === 0} 
                    className="flex items-center gap-2"
                  >
                    {calling ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Llamando...
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        Disparar llamada de prueba
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Form to Create/Edit Agent */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>{agentId ? 'Modificar Agente' : 'Crear Agente'}</CardTitle>
              <CardDescription>
                Define la personalidad y objetivo del asistente de voz.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agentName">Nombre</Label>
                  <Input
                    id="agentName"
                    type="text"
                    placeholder="Ej. Asistente Comercial"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voice">Voz Conversacional</Label>
                  <Select
                    id="voice"
                    options={voiceOptions}
                    value={agentVoice}
                    onChange={(e) => setAgentVoice(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="goal">Objetivo</Label>
                    <Select
                      id="goal"
                      options={[
                        { value: 'agendar_reunion', label: 'Agendar Reunión' },
                        { value: 'encuesta', label: 'Encuesta' },
                        { value: 'soporte', label: 'Soporte' },
                      ]}
                      value={agentGoal}
                      onChange={(e) => setAgentGoal(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duración Cita (Min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={meetingDuration}
                      onChange={(e) => setMeetingDuration(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="script">Guion / System Prompt</Label>
                  <Textarea
                    id="script"
                    className="min-h-[140px] leading-relaxed"
                    placeholder="Instrucciones del agente de voz. Ejemplo: Eres un asistente de ventas. Tu meta es contactar con el cliente, responder preguntas comunes sobre nuestro producto e inducirlo a agendar una llamada de 15 minutos..."
                    value={agentScript}
                    onChange={(e) => setAgentScript(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-between gap-3">
                {agentId && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      setAgentId('');
                      setAgentName('');
                      setAgentScript('');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={saving} 
                  className="w-full flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      {agentId ? 'Guardar Cambios' : 'Crear Agente'}
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

