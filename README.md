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
3. Registra en Vercel las variables de `.env.example` para Production, Preview y Development segun corresponda. `DATABASE_URL` debe contener la conexión PostgreSQL de Supabase para que Vercel aplique las migraciones antes de compilar.
4. Para Calendar, despliega `google-apps-script/Code.gs` como Web App y configura `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_SECRET`.
5. En produccion usa `NEXT_PUBLIC_USE_MOCK_SERVICES=false`.

El archivo `vercel.json` ejecuta `npm run db:migrate` antes de cada compilación. Drizzle solo aplica las migraciones que todavía no estén registradas en la base de datos.

### Acceso privado

El panel y sus APIs estan protegidos por un login administrativo. Configura estas tres variables en Vercel y vuelve a desplegar:

```env
AUTH_USERNAME=tu_usuario
AUTH_PASSWORD=una_contrasena_larga_y_unica
AUTH_SECRET=un_valor_aleatorio_de_al_menos_32_caracteres
```

`AUTH_SECRET` firma la cookie privada de sesion y no debe compartirse ni publicarse. Las sesiones duran 12 horas. Los endpoints de webhook y TeXML de Telnyx permanecen publicos para que Telnyx pueda comunicarse con la aplicacion.

Nunca subas `.env.local`; Git lo excluye deliberadamente.
