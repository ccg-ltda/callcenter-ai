# Contact Center IA

Aplicacion de call center con Next.js, Supabase, Telnyx, Google Calendar mediante Apps Script y resumenes con OpenAI.

## Getting Started

Instala las dependencias, copia `.env.example` como `.env.local` y completa las variables necesarias. Para trabajar sin servicios externos, conserva `NEXT_PUBLIC_USE_MOCK_SERVICES=true`.

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Importa este repositorio en Vercel.
2. Usa el preset **Next.js** y deja los comandos predeterminados (`npm run build`).
3. Registra en Vercel las variables de `.env.example` para Production, Preview y Development segun corresponda.
4. Para Calendar, despliega `google-apps-script/Code.gs` como Web App y configura `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_SECRET`.
5. En produccion usa `NEXT_PUBLIC_USE_MOCK_SERVICES=false`.

Nunca subas `.env.local`; Git lo excluye deliberadamente.
