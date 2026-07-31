'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from '@/components/ui';
import {
  AvailablePhoneNumber,
  PHONE_NUMBER_ADMINISTRATIVE_AREAS,
  PHONE_NUMBER_COUNTRIES,
} from '@/lib/phoneNumberLocations';

interface OwnedPhoneNumber {
  phoneNumber: string;
  status: string;
  inboundAgentId: string;
  isDefaultOutbound: boolean;
}

interface AgentOption {
  id: string;
  name: string;
}

export default function NumbersPage() {
  const [loading, setLoading] = useState(true);
  const [ownedNumbers, setOwnedNumbers] = useState<OwnedPhoneNumber[]>([]);
  const [defaultOutboundNumber, setDefaultOutboundNumber] = useState('');
  const [inboundSelections, setInboundSelections] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [savingInbound, setSavingInbound] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [operationError, setOperationError] = useState('');

  const [searchCountry, setSearchCountry] = useState('CO');
  const [searchAdministrativeArea, setSearchAdministrativeArea] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<AvailablePhoneNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const hasMaskedNumbers = availableNumbers.some((number) => !number.isPurchasable);

  const loadInventory = async () => {
    try {
      const [inventoryResponse, agentsResponse] = await Promise.all([
        fetch('/api/telnyx/numbers/owned'),
        fetch('/api/agents'),
      ]);
      const inventory = await inventoryResponse.json();
      if (!inventoryResponse.ok) {
        throw new Error(inventory.error || 'No se pudo cargar el inventario Telnyx.');
      }
      const numbers = Array.isArray(inventory.numbers) ? inventory.numbers : [];
      setOwnedNumbers(numbers);
      setDefaultOutboundNumber(inventory.defaultOutboundNumber || '');
      setMigrationRequired(Boolean(inventory.migrationRequired));
      setInboundSelections(Object.fromEntries(
        numbers.map((number: OwnedPhoneNumber) => [number.phoneNumber, number.inboundAgentId || '']),
      ));
      if (agentsResponse.ok) setAgents(await agentsResponse.json());
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const clearOperationStatus = () => {
    setOperationError('');
    setOperationMessage('');
  };

  const handleSetDefault = async (phoneNumber: string) => {
    setSettingDefault(phoneNumber);
    clearOperationStatus();
    try {
      const response = await fetch('/api/telnyx/numbers/owned', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-default-outbound', phoneNumber }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'No se pudo seleccionar la línea saliente.');
      setDefaultOutboundNumber(phoneNumber);
      setOwnedNumbers((current) => current.map((number) => ({
        ...number,
        isDefaultOutbound: number.phoneNumber === phoneNumber,
      })));
      setOperationMessage(`${phoneNumber} es ahora la línea saliente predeterminada.`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No se pudo seleccionar la línea saliente.');
    } finally {
      setSettingDefault(null);
    }
  };

  const handleSaveInbound = async (phoneNumber: string) => {
    const agentId = inboundSelections[phoneNumber] || '';
    if (!agentId) return;
    setSavingInbound(phoneNumber);
    clearOperationStatus();
    try {
      const response = await fetch('/api/telnyx/inbound-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, phoneNumber }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'No se pudo activar la línea entrante.');
      setOperationMessage(`Línea ${phoneNumber} activada para llamadas entrantes.`);
      await loadInventory();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'No se pudo activar la línea entrante.');
    } finally {
      setSavingInbound(null);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setHasSearched(true);
    setSearchError('');
    setAvailableNumbers([]);
    try {
      const query = new URLSearchParams({
        country: searchCountry,
        administrativeArea: searchAdministrativeArea,
        city: searchCity.trim(),
      });
      const response = await fetch(`/api/telnyx/numbers?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al buscar números.');
      setAvailableNumbers(data || []);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'No se pudo completar la búsqueda.');
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async (phoneNumber: string) => {
    setBuyingNumber(phoneNumber);
    clearOperationStatus();
    try {
      const response = await fetch('/api/telnyx/numbers/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Error al realizar la compra.');
      setAvailableNumbers([]);
      setOperationMessage(`${phoneNumber} fue adquirido y agregado al inventario.`);
      await loadInventory();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Error al comprar el número.');
    } finally {
      setBuyingNumber(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Números Telnyx</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra varias líneas para llamadas salientes y entrantes con agentes de IA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventario de líneas</CardTitle>
          <CardDescription>
            Elige la salida predeterminada y asigna un agente receptor diferente a cada número.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {migrationRequired && (
            <StatusMessage type="warning">
              Aplica la migración 0003_multi_number_inventory.sql para guardar asignaciones independientes.
            </StatusMessage>
          )}
          {operationError && <StatusMessage type="error">{operationError}</StatusMessage>}
          {operationMessage && <StatusMessage type="success">{operationMessage}</StatusMessage>}

          {ownedNumbers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No hay números activos en la cuenta. Usa el buscador para comprar el primero.
            </div>
          ) : (
            <div className="space-y-3">
              {ownedNumbers.map((number) => {
                const isDefault = number.phoneNumber === defaultOutboundNumber;
                const isActive = number.status === 'active';
                const selectedAgentId = inboundSelections[number.phoneNumber] || '';
                return (
                  <div
                    key={number.phoneNumber}
                    className="grid gap-4 rounded-xl border border-border bg-background p-4 lg:grid-cols-[1fr_1.2fr_auto] lg:items-end"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold">{number.phoneNumber}</span>
                        {isDefault && (
                          <span className="flex items-center gap-1 rounded border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#3b82f6]">
                            <ShieldCheck size={11} /> Salida predeterminada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Estado Telnyx: {number.status}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`agent-${number.phoneNumber}`}>Agente para llamadas entrantes</Label>
                      <Select
                        id={`agent-${number.phoneNumber}`}
                        options={[
                          { value: '', label: agents.length ? 'Selecciona un agente' : 'No hay agentes disponibles' },
                          ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
                        ]}
                        value={selectedAgentId}
                        onChange={(event) => {
                          setInboundSelections((current) => ({
                            ...current,
                            [number.phoneNumber]: event.target.value,
                          }));
                          clearOperationStatus();
                        }}
                        disabled={!agents.length || migrationRequired}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={isDefault ? 'secondary' : 'outline'}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleSetDefault(number.phoneNumber)}
                        disabled={!isActive || isDefault || settingDefault === number.phoneNumber}
                      >
                        {settingDefault === number.phoneNumber
                          ? <Loader2 className="animate-spin" size={14} />
                          : <Phone size={14} />}
                        {isDefault ? 'Predeterminada' : 'Usar para salida'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleSaveInbound(number.phoneNumber)}
                        disabled={!isActive || !selectedAgentId || migrationRequired || savingInbound === number.phoneNumber}
                      >
                        {savingInbound === number.phoneNumber
                          ? <Loader2 className="animate-spin" size={14} />
                          : <Save size={14} />}
                        Activar entrada
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Buscar números</CardTitle>
            <CardDescription>Consulta inventario disponible directamente en Telnyx.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSearch}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-1">
                  <Globe size={12} /> País
                </Label>
                <Select
                  id="country"
                  options={PHONE_NUMBER_COUNTRIES}
                  value={searchCountry}
                  onChange={(event) => {
                    setSearchCountry(event.target.value);
                    setSearchAdministrativeArea('');
                    setSearchCity('');
                  }}
                />
              </div>

              {PHONE_NUMBER_ADMINISTRATIVE_AREAS[searchCountry] && (
                <div className="space-y-2">
                  <Label htmlFor="administrative-area" className="flex items-center gap-1">
                    <MapPin size={12} /> Estado / Provincia
                  </Label>
                  <Select
                    id="administrative-area"
                    options={PHONE_NUMBER_ADMINISTRATIVE_AREAS[searchCountry]}
                    value={searchAdministrativeArea}
                    onChange={(event) => setSearchAdministrativeArea(event.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-1">
                  <MapPin size={12} /> Ciudad (opcional)
                </Label>
                <Input
                  id="city"
                  placeholder={searchCountry === 'US' ? 'Ejemplo: Miami' : 'Ejemplo: Bogotá'}
                  value={searchCity}
                  onChange={(event) => setSearchCity(event.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={searching} className="w-full gap-2">
                {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                {searching ? 'Buscando…' : 'Buscar disponibles'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="flex min-h-[400px] flex-col lg:col-span-2">
          <CardHeader>
            <CardTitle>Números disponibles</CardTitle>
            <CardDescription>La compra agregará una nueva línea sin reemplazar las existentes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {searchError ? (
              <EmptySearchState title="No pudimos buscar números" description={searchError} error />
            ) : availableNumbers.length === 0 ? (
              <EmptySearchState
                title={hasSearched ? 'No encontramos números disponibles' : 'Realiza una búsqueda'}
                description={hasSearched
                  ? 'Prueba con otra ciudad o deja la localidad vacía.'
                  : 'Selecciona país y localidad para buscar nuevas líneas.'}
              />
            ) : (
              <div className="space-y-4">
                {hasMaskedNumbers && (
                  <StatusMessage type="warning">
                    Telnyx está ocultando algunos números. Verifica la cuenta y el método de pago para comprarlos.
                  </StatusMessage>
                )}
                <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border bg-background/30">
                  {availableNumbers.map((number) => (
                    <div key={number.phoneNumber} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="block font-mono text-base font-bold">{number.phoneNumber}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">{number.type}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="block font-mono text-sm font-bold">${number.priceMonthly}</span>
                          <span className="text-[10px] text-muted-foreground">Mensual</span>
                        </div>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleBuy(number.phoneNumber)}
                          disabled={!number.isPurchasable || buyingNumber !== null}
                        >
                          {buyingNumber === number.phoneNumber
                            ? <Loader2 className="animate-spin" size={14} />
                            : <ShoppingCart size={14} />}
                          {number.isPurchasable ? 'Comprar' : 'No disponible'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto flex items-start gap-2 border-t border-border/30 pt-6 text-[11px] leading-relaxed text-muted-foreground">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#3b82f6]" />
              Algunos países exigen documentación regulatoria o domicilio local antes de activar una línea.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusMessage({
  children,
  type,
}: {
  children: React.ReactNode;
  type: 'success' | 'warning' | 'error';
}) {
  const styles = {
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    error: 'border-red-500/20 bg-red-500/10 text-red-300',
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${styles[type]}`}>
      {type === 'success'
        ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function EmptySearchState({
  title,
  description,
  error = false,
}: {
  title: string;
  description: string;
  error?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center space-y-3 p-8 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${error ? 'bg-red-500/10 text-red-400' : 'bg-muted/40 text-muted-foreground'}`}>
        {error ? <AlertCircle size={22} /> : <Search size={22} />}
      </div>
      <div className="max-w-sm space-y-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
