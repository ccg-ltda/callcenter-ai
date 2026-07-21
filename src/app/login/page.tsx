import { Headphones, LockKeyhole, PhoneCall, ShieldCheck } from 'lucide-react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-20%] h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-25%] right-[-10%] h-[38rem] w-[38rem] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:36px_36px]" />
      </div>

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl shadow-black/20 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-[#0d1524] p-12 text-white lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.22),transparent_36%),radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.18),transparent_35%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/25">
              <Headphones size={23} />
            </div>
            <div>
              <p className="font-semibold tracking-wide">Contact Center IA</p>
              <p className="text-xs text-blue-300">Operación inteligente</p>
            </div>
          </div>

          <div className="relative max-w-md">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-200">
              <ShieldCheck size={14} /> Acceso protegido
            </span>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">Tus llamadas y créditos, bajo control.</h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Accede al panel privado para administrar agentes, campañas y llamadas con Telnyx.
            </p>
          </div>

          <div className="relative flex items-center gap-3 text-sm text-slate-400">
            <PhoneCall size={17} className="text-blue-400" /> Solo personal autorizado
          </div>
        </div>

        <div className="flex min-h-[580px] items-center px-6 py-12 sm:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Headphones size={21} />
              </div>
              <span className="font-semibold">Contact Center IA</span>
            </div>

            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LockKeyhole size={23} />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">Bienvenido</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Ingresa tus credenciales para continuar al panel.</p>
            </div>

            <LoginForm />
            <p className="mt-7 text-center text-xs text-muted-foreground">Sesión privada y protegida con cookie segura.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
