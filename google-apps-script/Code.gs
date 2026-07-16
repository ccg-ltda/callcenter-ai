/**
 * CallCenter IA -> Google Calendar webhook.
 *
 * Script properties required:
 * - WEBHOOK_SECRET: long random value shared with Vercel.
 * - CALENDAR_ID: optional; defaults to the primary calendar of the script owner.
 */

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ ok: true, service: 'CallCenter IA Calendar' });
}

function doPost(event) {
  try {
    if (!event || !event.postData || !event.postData.contents) {
      throw new Error('Solicitud vacía.');
    }

    const payload = JSON.parse(event.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('WEBHOOK_SECRET');

    if (!expectedSecret || payload.secret !== expectedSecret) {
      throw new Error('Solicitud no autorizada.');
    }

    if (payload.action === 'health') {
      return jsonResponse({ ok: true });
    }

    if (payload.action !== 'createEvent') {
      throw new Error('Acción no soportada.');
    }

    if (!payload.title || !payload.scheduledAt) {
      throw new Error('Faltan el título o la fecha de la reunión.');
    }

    const start = new Date(payload.scheduledAt);
    const durationMin = Number(payload.durationMin || 15);
    if (isNaN(start.getTime()) || !isFinite(durationMin) || durationMin <= 0) {
      throw new Error('Fecha o duración inválida.');
    }

    const calendarId = properties.getProperty('CALENDAR_ID');
    const calendar = calendarId
      ? CalendarApp.getCalendarById(calendarId)
      : CalendarApp.getDefaultCalendar();
    if (!calendar) throw new Error('No se encontró el calendario configurado.');

    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    const calendarEvent = calendar.createEvent(String(payload.title), start, end, {
      description: String(payload.description || ''),
    });

    return jsonResponse({ ok: true, id: calendarEvent.getId() });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}
