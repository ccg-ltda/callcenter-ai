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
3. Registra en Vercel las variables de `.env.example` para Production, Preview y Development segun corresponda. `DATABASE_URL` debe contener la conexión PostgreSQL de Supabase para las tareas de base de datos.
4. Para Calendar, despliega `google-apps-script/Code.gs` como Web App y configura `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_SECRET`.
5. En produccion usa `NEXT_PUBLIC_USE_MOCK_SERVICES=false`.

Las bases existentes deben actualizarse desde Supabase SQL Editor con la migración
[`drizzle/0002_security_hardening.sql`](drizzle/0002_security_hardening.sql). El despliegue
de Vercel no ejecuta automáticamente el historial de Drizzle.

### Acceso privado

El panel y sus APIs estan protegidos por un login administrativo. Configura estas tres variables en Vercel y vuelve a desplegar:

```env
AUTH_USERNAME=tu_usuario
AUTH_PASSWORD=una_contrasena_larga_y_unica_de_12_o_mas_caracteres
AUTH_SECRET=un_valor_aleatorio_de_al_menos_32_caracteres
```

`AUTH_SECRET` firma la cookie privada de sesión y no debe compartirse ni publicarse.
Las sesiones duran 8 horas. Cada API privada vuelve a validar la sesión, además de la
protección de navegación.

### Despliegue del endurecimiento de seguridad

Antes de ejecutar la migración o desplegar, configura en el entorno:

```env
TELNYX_API_KEY=...
TELNYX_PUBLIC_KEY=...
TELNYX_WEBHOOK_SECRET=un_valor_aleatorio_de_al_menos_32_caracteres
TELNYX_TEXML_APPLICATION_ID=... # opcional; ID de una aplicacion TeXML
TOKEN_ENCRYPTION_KEY=un_valor_aleatorio_de_al_menos_32_caracteres
```

`TELNYX_PUBLIC_KEY` es la clave pública Ed25519 disponible en el portal de Telnyx.
`TELNYX_WEBHOOK_SECRET` protege las URLs de callback generadas por la aplicación.
`TELNYX_TEXML_APPLICATION_ID` es opcional. Si se configura, debe apuntar a una aplicación
TeXML, no a una conexión de Call Control. Si se omite o el ID ya no existe, la aplicación
busca o crea automáticamente la aplicación TeXML necesaria para las llamadas salientes.
`TOKEN_ENCRYPTION_KEY` cifra tokens persistidos; si se omite se deriva una clave de
`AUTH_SECRET`, por lo que no debe rotarse sin planificar la migración de los tokens.

Orden recomendado:

1. Configura las variables anteriores, incluyendo `TELNYX_API_KEY`.
2. Ejecuta `drizzle/0002_security_hardening.sql` en Supabase. Esta migración activa RLS,
   revoca acceso de clientes, crea rate limiting e idempotencia, y elimina la copia
   heredada de la clave Telnyx guardada en `settings`.
3. Ejecuta `drizzle/0003_multi_number_inventory.sql` para habilitar el inventario de
   líneas, el agente entrante por número y la selección de salida por campaña.
4. Despliega la aplicación.
5. Vuelve a activar el enrutamiento entrante o actualiza la aplicación de voz en Telnyx
   para que sus callbacks usen las nuevas URLs protegidas.

Los webhooks y TeXML siguen siendo accesibles por Telnyx, pero ahora requieren la firma
Ed25519 oficial o el token de callback generado por el servidor. Los refresh tokens
heredados de Google se cifran de forma diferida la próxima vez que se cree un evento;
las conexiones nuevas se guardan cifradas desde el inicio.

Nunca subas `.env.local`; Git lo excluye deliberadamente.
