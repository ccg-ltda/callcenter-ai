import Sidebar from '@/components/Sidebar';
import ThemeToggle from '@/components/ThemeToggle';
import { ShieldCheck } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true';

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header bar */}
        <header className="h-20 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30 px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Page title space (gets filled dynamically or static default) */}
            <h2 className="font-semibold text-lg tracking-wide text-foreground hidden sm:block">Panel de Control</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <div className="flex items-center gap-4 text-xs font-mono">
              {isMock && (
                <span className="flex items-center gap-1.5 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 px-2.5 py-1 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
                  MOCK MODE
                </span>
              )}
              
              <div className="hidden md:flex items-center gap-1.5 text-muted-foreground bg-surface border border-border px-2.5 py-1 rounded-full">
                <ShieldCheck size={14} className="text-[#3b82f6]" />
                Supabase Conectado
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Inner Content scrollable container */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
