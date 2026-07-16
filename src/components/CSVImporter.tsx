'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { Button } from '@/components/ui';

interface ParsedContact {
  fullName: string;
  phone: string;
  company?: string;
  _isValid: boolean;
  _error?: string;
}

interface CSVImporterProps {
  campaignId: string;
  onImportComplete: (count: number) => void;
}

function parsePhoneNumber(phone: string): { valid: boolean; formatted: string } {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Basic validation: must start with + or digit, and be between 7-15 digits
  const valid = /^\+?[1-9]\d{6,14}$/.test(cleaned);
  const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  return { valid, formatted };
}

function parseCSV(text: string): ParsedContact[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Auto-detect headers
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const nameCol = headers.findIndex(h => ['nombre', 'name', 'full_name', 'fullname', 'contacto'].some(k => h.includes(k)));
  const phoneCol = headers.findIndex(h => ['telefono', 'teléfono', 'phone', 'tel', 'celular', 'movil', 'móvil', 'mobile'].some(k => h.includes(k)));
  const companyCol = headers.findIndex(h => ['empresa', 'company', 'organización', 'org', 'organizacion'].some(k => h.includes(k)));

  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    const rawName = nameCol >= 0 ? cols[nameCol] || '' : cols[0] || '';
    const rawPhone = phoneCol >= 0 ? cols[phoneCol] || '' : cols[1] || '';
    const rawCompany = companyCol >= 0 ? cols[companyCol] || '' : cols[2] || '';

    const { valid, formatted } = parsePhoneNumber(rawPhone);

    contacts.push({
      fullName: rawName.trim() || 'Sin nombre',
      phone: formatted,
      company: rawCompany.trim() || undefined,
      _isValid: valid && rawName.trim().length > 0,
      _error: !valid ? 'Teléfono inválido' : (!rawName.trim() ? 'Sin nombre' : undefined),
    });
  }

  return contacts;
}

export default function CSVImporter({ campaignId, onImportComplete }: CSVImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Por favor sube un archivo CSV válido.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const contacts = parseCSV(text);
      setParsed(contacts);
      setImported(false);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const validContacts = parsed.filter(c => c._isValid);
  const invalidContacts = parsed.filter(c => !c._isValid);

  const handleImport = async () => {
    if (validContacts.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          contacts: validContacts.map(({ _isValid, _error, ...c }) => c),
        }),
      });

      if (!res.ok) throw new Error('Error al importar contactos');
      const data = await res.json();
      setImported(true);
      onImportComplete(data.imported);
    } catch (error: any) {
      alert(error.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setParsed([]);
    setFileName('');
    setImported(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSampleCSV = () => {
    const sample = `nombre,telefono,empresa
Juan Pérez,+5491155551234,Acme Corp
María García,+5493415556789,Globex
Carlos López,+34600555123,Initech`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contactos_muestra.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {parsed.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-[#3b82f6] bg-[#3b82f6]/5 scale-[1.01]'
              : 'border-border hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/5'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`p-4 rounded-full transition-all ${isDragging ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-muted/50 text-muted-foreground'}`}>
              <Upload size={28} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra y suelta tu CSV aquí'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar el archivo</p>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Columnas esperadas: <span className="text-muted-foreground">nombre, telefono, empresa</span>
            </p>
          </div>
        </div>
      )}

      {/* Preview & Validation */}
      {parsed.length > 0 && !imported && (
        <div className="space-y-3">
          {/* File info & stats */}
          <div className="flex items-center justify-between bg-background border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6]">
                <FileText size={18} />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground block">{fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {parsed.length} filas detectadas · <span className="text-[#3b82f6]">{validContacts.length} válidos</span>
                  {invalidContacts.length > 0 && <span className="text-red-400"> · {invalidContacts.length} con errores</span>}
                </span>
              </div>
            </div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-foreground p-1 rounded cursor-pointer transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Preview table */}
          <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface sticky top-0">
                <tr>
                  <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">Nombre</th>
                  <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">Teléfono</th>
                  <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">Empresa</th>
                  <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {parsed.map((c, i) => (
                  <tr key={i} className={`${c._isValid ? 'hover:bg-surface/50' : 'bg-red-900/10'} transition-colors`}>
                    <td className="p-3 text-foreground">{c.fullName}</td>
                    <td className="p-3 font-mono text-muted-foreground">{c.phone}</td>
                    <td className="p-3 text-muted-foreground">{c.company || '—'}</td>
                    <td className="p-3">
                      {c._isValid ? (
                        <span className="flex items-center gap-1 text-[#3b82f6]">
                          <CheckCircle size={12} /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle size={12} /> {c._error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import Button */}
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={handleReset} size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || validContacts.length === 0}
              className="flex items-center gap-2"
            >
              {importing ? 'Importando...' : `Importar ${validContacts.length} contactos`}
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {imported && (
        <div className="flex items-center gap-4 bg-[#3b82f6]/10 border border-[#3b82f6]/25 p-5 rounded-xl">
          <div className="p-2.5 rounded-full bg-[#3b82f6]/20 text-[#3b82f6]">
            <CheckCircle size={22} />
          </div>
          <div>
            <span className="font-semibold text-foreground block">{validContacts.length} contactos importados con éxito</span>
            <span className="text-xs text-muted-foreground">Los contactos están listos para ser incluidos en la campaña.</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="ml-auto">
            Importar más
          </Button>
        </div>
      )}

      {/* Sample Download Link */}
      {parsed.length === 0 && (
        <button
          onClick={downloadSampleCSV}
          className="flex items-center gap-1.5 text-xs text-[#3b82f6] hover:underline cursor-pointer mt-1"
        >
          <Download size={13} /> Descargar CSV de ejemplo
        </button>
      )}
    </div>
  );
}

