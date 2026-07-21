'use client';

import { useState } from 'react';
import { LoaderCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function logout() {
    setIsSubmitting(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isSubmitting}
      className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-60"
    >
      {isSubmitting ? <LoaderCircle className="animate-spin" size={15} /> : <LogOut size={15} />}
      {isSubmitting ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  );
}
