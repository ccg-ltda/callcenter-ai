'use client';

import { useState, useEffect } from 'react';
import { 
  Phone, 
  Search, 
  ShoppingCart, 
  Loader2, 
  ShieldCheck, 
  Globe, 
  MapPin,
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
  Select 
} from '@/components/ui';

export default function NumbersPage() {
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState(false);

  // Active settings
  const [currentNumber, setCurrentNumber] = useState('');
  
  // Search parameters
  const [searchCountry, setSearchCountry] = useState('CO');
  const [searchCity, setSearchCity] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);

  // Load current setting number
  const loadCurrentNumber = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setCurrentNumber(data?.telnyxPhoneNumber || 'Ninguno');
      }
    } catch (err) {
      console.error('Error loading current number:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentNumber();
  }, []);

  // Search numbers
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    try {
      const res = await fetch(`/api/telnyx/numbers?country=${searchCountry}&city=${searchCity}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al buscar números');
      setAvailableNumbers(data || []);
    } catch (error: any) {
      alert(error.message || 'Error al buscar números');
    } finally {
      setSearching(false);
    }
  };

  // Buy number
  const handleBuy = async (number: string) => {
    setBuying(true);
    try {
      // 1. Buy via API
      const resBuy = await fetch('/api/telnyx/numbers/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: number }),
      });
      if (!resBuy.ok) throw new Error('Error al realizar la compra');
      
      // 2. Update settings in DB
      const resSettings = await fetch('/api/settings');
      const currentSettings = await resSettings.json();
      
      const resUpdate = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentSettings,
          telnyxPhoneNumber: number
        })
      });
      
      if (!resUpdate.ok) throw new Error('Error al asociar el número a la cuenta');

      alert(`Número ${number} adquirido y configurado como número saliente.`);
      setCurrentNumber(number);
      setAvailableNumbers([]);
    } catch (error: any) {
      alert(error.message || 'Error al comprar número');
    } finally {
      setBuying(false);
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Comprar Número de Teléfono</h1>
        <p className="text-muted-foreground mt-1 text-sm">Adquiere un número telefónico local en Telnyx para asociar tus campañas y realizar llamadas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Current status & Search form */}
        <div className="space-y-6">
          {/* Active number card */}
          <Card>
            <CardHeader>
              <CardTitle>Línea Saliente Activa</CardTitle>
              <CardDescription>Número actual asignado para las campañas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-background border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                    <Phone size={18} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block uppercase font-mono">Número actual</span>
                    <span className="font-mono text-sm font-bold text-foreground">{currentNumber}</span>
                  </div>
                </div>
                {currentNumber !== 'Ninguno' && (
                  <span className="flex items-center gap-1 text-[10px] text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded font-mono font-semibold">
                    <ShieldCheck size={12} /> Activo
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search Card */}
          <Card>
            <CardHeader>
              <CardTitle>Buscador de Números</CardTitle>
              <CardDescription>Busca números disponibles en la red de Telnyx.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSearch}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country" className="flex items-center gap-1">
                    <Globe size={12} /> País
                  </Label>
                  <Select
                    id="country"
                    options={[
                      { value: 'CO', label: 'Colombia (CO)' },
                      { value: 'US', label: 'Estados Unidos (US)' },
                      { value: 'AR', label: 'Argentina (AR)' },
                      { value: 'MX', label: 'México (MX)' },
                      { value: 'ES', label: 'España (ES)' },
                    ]}
                    value={searchCountry}
                    onChange={(e) => { setSearchCountry(e.target.value); setSearchCity(''); }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center gap-1">
                    <MapPin size={12} /> Localidad / Ciudad
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="Opcional: Bogotá, Medellín…"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  disabled={searching} 
                  className="w-full flex items-center justify-center gap-2"
                >
                  {searching ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Buscar Disponibles
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right column: Results list */}
        <div className="lg:col-span-2">
          <Card className="h-full min-h-[400px] flex flex-col">
            <CardHeader>
              <CardTitle>Números Disponibles</CardTitle>
              <CardDescription>Selecciona un número de la red para comprarlo.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              {availableNumbers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="h-12 w-12 rounded-full bg-muted/40 text-muted-foreground flex items-center justify-center">
                    <Search size={22} />
                  </div>
                  <div className="max-w-xs space-y-1">
                    <h4 className="font-semibold text-muted-foreground text-sm">Realiza una búsqueda</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Elige el país y localidad en la izquierda para buscar y comprar nuevos números.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50 bg-background/30">
                  {availableNumbers.map((num) => (
                    <div 
                      key={num.phoneNumber} 
                      className="p-4 flex items-center justify-between hover:bg-surface/60 transition-colors"
                    >
                      <div className="space-y-1">
                        <span className="font-mono text-base font-bold text-foreground block">{num.phoneNumber}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">{num.type}</span>
                          <span className="text-[10px] text-[#3b82f6] font-mono font-semibold">{num.provider} Network</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-bold text-foreground font-mono block">${num.priceMonthly}</span>
                          <span className="text-[10px] text-muted-foreground block">Facturación mensual</span>
                        </div>
                        <Button 
                          onClick={() => handleBuy(num.phoneNumber)} 
                          disabled={buying}
                          className="flex items-center gap-1.5 h-9"
                          size="sm"
                        >
                          {buying ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <>
                              <ShoppingCart size={14} />
                              Comprar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2 text-muted-foreground text-[11px] leading-relaxed mt-6 border-t border-border/30 pt-4">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-[#3b82f6]" />
                <span>
                  <strong>Aviso legal:</strong> Asegúrate de verificar las regulaciones locales sobre la compra de números de teléfono en el país seleccionado. Algunos países exigen documentación de domicilio local.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

