# Google Apps Script para Calendar

1. Abre [script.google.com](https://script.google.com/) con la cuenta dueña del calendario y crea un proyecto.
2. Reemplaza el contenido de `Code.gs` con el archivo de esta carpeta.
3. En **Configuración del proyecto > Propiedades del script**, agrega:
   - `WEBHOOK_SECRET`: una cadena aleatoria larga.
   - `CALENDAR_ID`: opcional; omítelo para usar el calendario principal.
4. Selecciona **Implementar > Nueva implementación > Aplicación web**.
5. Configura **Ejecutar como: Yo** y permite acceso a **Cualquier usuario**.
6. Autoriza el acceso a Calendar y copia la URL terminada en `/exec`.
7. En Vercel configura `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_SECRET` para Production y redepliega.

La Web App valida el secreto antes de aceptar una solicitud. Nunca escribas el secreto dentro de `Code.gs` ni lo subas a GitHub.
