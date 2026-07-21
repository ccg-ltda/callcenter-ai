'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  PhoneCall, 
  Users, 
  Radio, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Settings, 
  Menu, 
  X,
  Compass,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import LogoutButton from '@/components/LogoutButton';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Campañas', href: '/campaigns', icon: Compass },
    { name: 'Contactos', href: '/contacts', icon: Users },
    { name: 'Agentes de Voz', href: '/agents', icon: Bot },
    { name: 'Comprar Números', href: '/numbers', icon: PhoneCall },
    { name: 'Llamadas en Vivo', href: '/live', icon: Radio },
    { name: 'Transcripciones', href: '/transcripts', icon: FileText },
    { name: 'Calendario', href: '/calendar', icon: Calendar },
    { name: 'Métricas & KPIs', href: '/kpis', icon: TrendingUp },
    { name: 'Configuración', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface border border-border text-foreground hover:bg-surface-2 transition-all cursor-pointer"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-64 border-r border-border bg-surface flex flex-col justify-between transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header Logo */}
        <div>
          <div className="h-20 flex items-center gap-3 px-6 border-b border-border/50">
            <div className="h-9 w-9 rounded-lg bg-[#3b82f6] flex items-center justify-center text-accent-foreground font-extrabold tracking-tight">
              CC
            </div>
            <div>
              <span className="font-semibold text-base tracking-wide block text-foreground">Contact Center IA</span>
              <span className="text-[10px] text-[#3b82f6] font-mono uppercase tracking-wider">Dashboard</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-160px)]">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group",
                    isActive
                      ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/25 shadow-[0_0_15px_rgba(59,130,246,0.05)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-2/40 border border-transparent"
                  )}
                >
                  <Icon 
                    size={18} 
                    className={cn(
                      "transition-colors",
                      isActive ? "text-[#3b82f6]" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-border/50 bg-background/30">
          <div className="flex items-center justify-between gap-2 px-2 text-[11px] text-muted-foreground font-mono">
            <span>Versión 1.0.0</span>
            <span className="flex items-center gap-1 text-[#3b82f6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]"></span>
              En Línea
            </span>
          </div>
          <div className="mt-3 flex justify-start">
            <ThemeToggle />
          </div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}

