'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Key, 
  Phone, 
  Bot, 
  Calendar, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Loader2, 
  Search, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
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

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- STEP 1: Telnyx API Key ---
  const [telnyxApiKey, setTelnyxApiKey] = useState('');

  // --- STEP 2: Phone Number Selection ---
  const [searchCountry, setSearchCountry] = useState('US');
  const [searchCity, setSearchCity] = useState('Miami');
  const [numbersList, setNumbersList] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState(false);

  // --- STEP 3: First Agent Setup ---
  const [agentName, setAgentName] = useState('Asistente Agendador');
  const [agentVoice, setAgentVoice] = useState('telnyx_voice_en_female_1');
  const [agentScript, setAgentScript] = useState(
    'Hola, soy el agente de IA de Contact Center IA. Te llamo para saber si te gustaría agendar una reunión comercial esta semana. ¿Tienes 15 minutos disponibles el jueves por la mañana?'
  );
  const [agentGoal, setAgentGoal] = useState('agendar_reunion');
  const [meetingDuration, setMeetingDuration] = useState(15);

  // --- STEP 4: Google Calendar ---
  const [googleConnected, setGoogleConnected] = useState(false);

  const voiceOptions = [
    { value: 'telnyx_voice_en_female_1', label: 'Inglés - Femenina 1' },
    { value: 'telnyx_voice_en_male_1', label: 'Inglés - Masculina 1' },
    { value: 'telnyx_voice_es_female_1', label: 'Español - Femenina 1 (Recomendada)' },
    { value: 'telnyx_voice_es_male_1', label: 'Español - Masculina 1' },
  ];

  // Search numbers from API
  const handleSearchNumbers = async () => {
    setSearchingNumbers(true);
    try {
      const res = await fetch(`/api/telnyx/numbers?country=${searchCountry}&city=${searchCity}`);
      if (!res.ok) throw new Error('Error al buscar números');
      const data = await res.json();
      setNumbersList(data);
      if (data.length > 0) {
        setSelectedNumber(data[0].phoneNumber);
      }
    } catch (error) {
      console.error(error);
      alert('Error buscando números.');
    } finally {
      setSearchingNumbers(false);
    }
  };

  // Buy selected number
  const handleBuyNumber = async () => {
    if (!selectedNumber) return;
    setBuyingNumber(true);
    try {
      const res = await fetch('/api/telnyx/numbers/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selectedNumber }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Error al comprar el número');
      alert(`Número ${selectedNumber} comprado y configurado exitosamente.`);
      setCurrentStep(3);
    } catch (error) {
      console.error(error);
      alert('Error al comprar número.');
    } finally {
      setBuyingNumber(false);
    }
  };

  // Complete step 3 (Agent) & save to DB
  const handleCreateAgent = async () => {
    if (!agentName || !agentScript) {
      alert('Por favor completa todos los campos.');
      return;
    }
    setLoading(true);
    try {
      // Save agent
      const resAgent = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'agent-1',
          name: agentName,
          voice: agentVoice,
          script: agentScript,
          goal: agentGoal,
          meetingDurationMin: meetingDuration,
          telnyxAssistantId: 'mock_assistant_123'
        })
      });

      if (!resAgent.ok) throw new Error('Error guardando el agente');

      setCurrentStep(4);
    } catch (error) {
      console.error(error);
      alert('Error configurando agente.');
    } finally {
      setLoading(false);
    }
  };

  // Complete onboarding (Step 4 Google & Save Settings)
  const handleCompleteOnboarding = async () => {
    setLoading(true);
    try {
      // Save settings to Supabase
      const resSettings = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telnyxApiKey: telnyxApiKey || 'mock_api_key_xxxxxxxx',
          telnyxPhoneNumber: selectedNumber || '+18005550199',
          telnyxAssistantId: 'mock_assistant_123',
          googleCalendarConnected: googleConnected,
          callWindowStart: '10:00',
          callWindowEnd: '18:00',
          timezone: 'America/Argentina/Buenos_Aires',
        })
      });

      if (!resSettings.ok) throw new Error('Error al guardar la configuración final');

      alert('¡Felicidades! Configuración inicial completada.');
      router.push('/');
    } catch (error) {
      console.error(error);
      alert('Error finalizando onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      {/* Visual background decor */}
      <div className="absolute w-96 h-96 rounded-full bg-[#3b82f6]/5 -top-48 -left-48 blur-3xl pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-[#3b82f6]/3 -bottom-48 -right-48 blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-[#3b82f6] flex items-center justify-center text-accent-foreground font-extrabold text-2xl mx-auto shadow-lg shadow-[#3b82f6]/20">
            CC
          </div>
          <h1 className="text-3xl font-extrabold mt-4 text-foreground tracking-tight">Bienvenido a Contact Center IA</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
            Configura tus servicios en unos simples pasos y empieza a automatizar tus campañas de llamadas salientes.
          </p>
        </div>

        {/* Steps Progress bar */}
        <div className="flex items-center justify-between max-w-md mx-auto relative px-4">
          <div className="absolute left-4 right-4 h-0.5 bg-surface-2 top-1/2 -translate-y-1/2 -z-10" />
          <div 
            className="absolute left-4 h-0.5 bg-[#3b82f6] top-1/2 -translate-y-1/2 -z-10 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />

          {[
            { step: 1, label: 'Telnyx', icon: Key },
            { step: 2, label: 'Número', icon: Phone },
            { step: 3, label: 'Agente', icon: Bot },
            { step: 4, label: 'Google', icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            const isCompleted = currentStep > item.step;
            const isActive = currentStep === item.step;
            
            return (
              <div key={item.step} className="flex flex-col items-center gap-1.5 relative">
                <div 
                  className={`h-9 w-9 rounded-full flex items-center justify-center border font-semibold text-sm transition-all ${
                    isCompleted 
                      ? 'bg-[#3b82f6] border-[#3b82f6] text-accent-foreground' 
                      : isActive 
                        ? 'bg-background border-[#3b82f6] text-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.2)] font-bold' 
                        : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : item.step}
                </div>
                <span className={`text-[10px] uppercase font-semibold tracking-wider ${
                  isActive ? 'text-[#3b82f6] font-bold' : 'text-muted-foreground'
                }`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Steps Cards */}
        <Card className="shadow-2xl">
          {/* STEP 1: TELNYX API KEY */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="text-[#3b82f6]" size={20} />
                  Paso 1: Conectar API Key de Telnyx
                </CardTitle>
                <CardDescription>
                  Necesitamos tu API Key para poder comunicarnos con Telnyx, buscar números y levantar los asistentes de voz.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Telnyx API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="KEYxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={telnyxApiKey}
                    onChange={(e) => setTelnyxApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Si no tienes una API Key o quieres probar de forma segura, déjalo en blanco y utilizaremos credenciales de prueba en el modo simulación.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-3">
                <Button 
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2"
                >
                  Siguiente paso <ArrowRight size={16} />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 2: NUMBER SELECTION */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="text-[#3b82f6]" size={20} />
                  Paso 2: Comprar Número de Teléfono
                </CardTitle>
                <CardDescription>
                  Busca un número de teléfono disponible en Telnyx para asociar a tu cuenta y poder realizar llamadas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Select
                      id="country"
                      options={[
                        { value: 'US', label: 'EE.UU. (US)' },
                        { value: 'AR', label: 'Argentina (AR)' },
                        { value: 'MX', label: 'México (MX)' },
                      ]}
                      value={searchCountry}
                      onChange={(e) => setSearchCountry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad / Región</Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="Miami"
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleSearchNumbers}
                  disabled={searchingNumbers}
                  className="w-full flex items-center justify-center gap-2 mt-2"
                >
                  {searchingNumbers ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                  Buscar números disponibles
                </Button>

                {numbersList.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label>Números Encontrados</Label>
                    <div className="border border-border rounded-lg divide-y divide-border/50 bg-background/50 max-h-[180px] overflow-y-auto">
                      {numbersList.map((num) => (
                        <label 
                          key={num.phoneNumber} 
                          className={`flex items-center justify-between p-3 cursor-pointer hover:bg-surface/60 transition-colors ${
                            selectedNumber === num.phoneNumber ? 'bg-[#3b82f6]/5 border-l-2 border-[#3b82f6]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input 
                              type="radio" 
                              name="selected_number"
                              checked={selectedNumber === num.phoneNumber}
                              onChange={() => setSelectedNumber(num.phoneNumber)}
                              className="accent-[#3b82f6]"
                            />
                            <span className="font-mono text-sm font-semibold">{num.phoneNumber}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-[#3b82f6] font-semibold font-mono">${num.priceMonthly}/mes</span>
                            <span className="text-[10px] text-muted-foreground block uppercase font-mono">{num.type}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(1)} className="flex items-center gap-2">
                  <ArrowLeft size={16} /> Atrás
                </Button>
                <Button 
                  onClick={handleBuyNumber} 
                  disabled={!selectedNumber || buyingNumber}
                  className="flex items-center gap-2"
                >
                  {buyingNumber ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Comprando...
                    </>
                  ) : (
                    <>
                      Comprar número <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 3: FIRST AGENT */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="text-[#3b82f6]" size={20} />
                  Paso 3: Configurar Primer Agente de IA
                </CardTitle>
                <CardDescription>
                  Crea la personalidad de tu agente, selecciona su voz y define el guion de venta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agentName">Nombre del Agente</Label>
                    <Input
                      id="agentName"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agentVoice">Voz del Agente</Label>
                    <Select
                      id="agentVoice"
                      options={voiceOptions}
                      value={agentVoice}
                      onChange={(e) => setAgentVoice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentScript">Guion del Agente (System Prompt)</Label>
                  <Textarea
                    id="agentScript"
                    className="min-h-[120px] leading-relaxed"
                    value={agentScript}
                    onChange={(e) => setAgentScript(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Instrucciones explícitas de comportamiento. El agente usará esto para guiar la llamada hacia el agendamiento.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(2)} className="flex items-center gap-2">
                  <ArrowLeft size={16} /> Atrás
                </Button>
                <Button onClick={handleCreateAgent} disabled={loading} className="flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <>Siguiente paso <ArrowRight size={16} /></>}
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 4: GOOGLE CALENDAR */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="text-[#3b82f6]" size={20} />
                  Paso 4: Conectar Calendario
                </CardTitle>
                <CardDescription>
                  Las citas agendadas por el agente de voz de IA se sincronizan directamente en Google Calendar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-6">
                <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border/80">
                  <div className="flex items-center gap-4">
                    <div className={`h-3.5 w-3.5 rounded-full ${
                      googleConnected ? 'bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]' : 'bg-muted'
                    }`} />
                    <div>
                      <span className="font-semibold text-sm block">Google Calendar</span>
                      <span className="text-xs text-muted-foreground">
                        {googleConnected ? 'Conexión activa' : 'Sin conectar'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant={googleConnected ? 'outline' : 'primary'}
                    onClick={() => {
                      setGoogleConnected(!googleConnected);
                      if (!googleConnected) {
                        alert('Google Calendar conectado exitosamente (Simulado).');
                      }
                    }}
                  >
                    {googleConnected ? 'Desconectar' : 'Conectar Cuenta'}
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(3)} className="flex items-center gap-2">
                  <ArrowLeft size={16} /> Atrás
                </Button>
                <Button onClick={handleCompleteOnboarding} disabled={loading} className="flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <>Finalizar Configuración <Check size={16} /></>}
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

