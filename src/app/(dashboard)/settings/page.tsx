'use client';

import { useState, useEffect } from 'react';
import { 
  Key, 
  Phone, 
  Bot, 
  Calendar, 
  Clock, 
  Globe, 
  Save, 
  Check, 
  Loader2, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
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
  cn
} from '@/components/ui';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Settings State
  const [telnyxApiKey, setTelnyxApiKey] = useState('');
  const [telnyxApiKeyConfigured, setTelnyxApiKeyConfigured] = useState(false);
  const [telnyxPhoneNumber, setTelnyxPhoneNumber] = useState('');
  const [telnyxAssistantId, setTelnyxAssistantId] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [callWindowStart, setCallWindowStart] = useState('10:00');
  const [callWindowEnd, setCallWindowEnd] = useState('18:00');
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');

  // Timezones Options
  const timezones = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
    { value: 'America/Mexico_City', label: 'México (CDMX)' },
    { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
    { value: 'America/Lima', label: 'Perú (Lima)' },
    { value: 'America/Santiago', label: 'Chile (Santiago)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
    { value: 'Europe/Madrid', label: 'España (Madrid)' },
    { value: 'America/New_York', label: 'EE.UU. (Eastern)' },
  ];

  // Fetch current settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        
        if (data) {
          setTelnyxApiKeyConfigured(Boolean(data.telnyxApiKeyConfigured));
          setTelnyxPhoneNumber(data.telnyxPhoneNumber || '');
          setTelnyxAssistantId(data.telnyxAssistantId || '');
          setGoogleConnected(!!data.googleCalendarConnected);
          setCallWindowStart(data.callWindowStart || '10:00');
          setCallWindowEnd(data.callWindowEnd || '18:00');
          setTimezone(data.timezone || 'America/Argentina/Buenos_Aires');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      setGoogleConnected(true);
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // Save settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telnyxApiKey: telnyxApiKey || undefined,
          telnyxPhoneNumber,
          telnyxAssistantId,
          callWindowStart,
          callWindowEnd,
          timezone,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar la configuración');
      alert('Configuración guardada exitosamente');
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleGoogleConnect = async () => {
    if (googleConnected) {
      const response = await fetch('/api/google/disconnect', { method: 'POST' });
      if (response.ok) setGoogleConnected(false);
    } else {
      window.location.href = '/api/google/auth';
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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white">Configuración</h1>
        <p className="text-zinc-400 mt-1 text-sm">Gestiona tus credenciales de telefonía, integración de Google Calendar y horarios de llamadas.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Telnyx Credentials Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <Key size={20} />
              </div>
              <div>
                <CardTitle>Credenciales de Telnyx</CardTitle>
                <CardDescription>Conecta tu cuenta de telefonía para realizar llamadas y comprar números.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="telnyxApiKey">Telnyx API Key</Label>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-[#3b82f6] hover:underline cursor-pointer"
                >
                  {showApiKey ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <Input
                id="telnyxApiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder={telnyxApiKeyConfigured ? '•••••••••••• (clave configurada)' : 'KEYxxxxxxxxxxxxxxxxxxxxxxxx'}
                value={telnyxApiKey}
                onChange={(e) => setTelnyxApiKey(e.target.value)}
              />
              <p className="text-[11px] text-zinc-500">
                La API Key de Telnyx se guarda de forma segura y encriptada en la base de datos Supabase.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telnyxPhoneNumber">Número de Teléfono Comprado</Label>
                <div className="relative">
                  <Input
                    id="telnyxPhoneNumber"
                    type="text"
                    placeholder="+1 (800) 555-0199"
                    value={telnyxPhoneNumber}
                    onChange={(e) => setTelnyxPhoneNumber(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500">
                    <Phone size={16} />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Número principal comprado para lanzar campañas de llamadas salientes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telnyxAssistantId">ID de Asistente de IA (Defecto)</Label>
                <div className="relative">
                  <Input
                    id="telnyxAssistantId"
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={telnyxAssistantId}
                    onChange={(e) => setTelnyxAssistantId(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500">
                    <Bot size={16} />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500">
                  ID del agente de voz de Telnyx por defecto para las llamadas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call Window Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <Clock size={20} />
              </div>
              <div>
                <CardTitle>Ventana Horaria de Llamadas</CardTitle>
                <CardDescription>Restringe el horario del motor de campañas para evitar molestar a deshoras.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="callWindowStart">Hora de Inicio</Label>
                <div className="relative">
                  <Input
                    id="callWindowStart"
                    type="time"
                    value={callWindowStart}
                    onChange={(e) => setCallWindowStart(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="callWindowEnd">Hora de Cierre</Label>
                <div className="relative">
                  <Input
                    id="callWindowEnd"
                    type="time"
                    value={callWindowEnd}
                    onChange={(e) => setCallWindowEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Zona Horaria</Label>
                <Select
                  id="timezone"
                  options={timezones}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-amber-400/80 bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg text-xs leading-relaxed mt-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Regla de negocio:</strong> El motor de llamadas en background respetará estrictamente este rango. 
                Si la campaña está corriendo pero el reloj está fuera de esta ventana, las llamadas se encolarán hasta el día siguiente.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Integración Google Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <Calendar size={20} />
              </div>
              <div>
                <CardTitle>Calendario de Reuniones</CardTitle>
                <CardDescription>Integra tu Google Calendar para agendar reuniones extraídas de las llamadas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between bg-[#0b0f14] p-4 rounded-xl border border-[#1f293d]/50">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-3 w-3 rounded-full shadow-[0_0_10px_currentColor]",
                  googleConnected ? "bg-[#3b82f6] text-[#3b82f6]" : "bg-zinc-600 text-zinc-600"
                )} />
                <div>
                  <span className="font-semibold text-sm block">Google Calendar</span>
                  <span className="text-xs text-zinc-400">
                    {googleConnected 
                      ? 'Integración activa: Las reuniones se crearán automáticamente.' 
                      : 'Sin conectar. Conéctate para agendar reuniones.'}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant={googleConnected ? 'outline' : 'primary'}
                onClick={handleGoogleConnect}
              >
                {googleConnected ? 'Desconectar cuenta' : 'Conectar Google Account'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Button Footer */}
        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
