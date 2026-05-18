/**
 * ============================================================
 *  LILI MAKEUP — Google Apps Script Backend
 *  Guarda reservas en Google Sheets y crea eventos en Google Calendar
 *  Expone disponibilidad en tiempo real
 * ============================================================
 *
 *  INSTRUCCIONES DE INSTALACIÓN:
 *  1. Ve a https://script.google.com/ → "Nuevo proyecto"
 *  2. Pega este código completo
 *  3. Rellena las constantes de configuración abajo
 *  4. Clic en "Implementar" → "Nueva implementación"
 *     - Tipo: Aplicación web
 *     - Ejecutar como: Yo (tu cuenta Google)
 *     - Quién tiene acceso: Cualquier persona
 *  5. Autoriza los permisos cuando te lo pida
 *  6. Copia la URL de la implementación y pégala en booking.js
 *     como valor de APPS_SCRIPT_URL
 * ============================================================
 */

/* ──────────────────────────────────────────────────────────
   CONFIGURACIÓN — Edita estos valores
────────────────────────────────────────────────────────── */
const CALENDAR_ID  = 'primary';           // 'primary' = tu calendario principal
                                           // o pega el ID del calendario específico
const SHEET_NAME   = 'Asesorias';         // Nombre de la hoja en Google Sheets
const SLOT_MINUTES = 60;                  // Duración de cada asesoría en minutos

// Horarios de trabajo (24h). Domingo = índice 0, Sábado = 6
const WORKING_HOURS = {
  1: { start: 8, end: 18 },  // Lunes
  2: { start: 8, end: 18 },  // Martes
  3: { start: 8, end: 18 },  // Miércoles
  4: { start: 8, end: 18 },  // Jueves
  5: { start: 8, end: 18 },  // Viernes
  6: { start: 8, end: 15 },  // Sábado (cierra a las 3pm)
  // 0: Domingo — cerrado (no aparece)
};

/* ──────────────────────────────────────────────────────────
   CORS HEADERS
────────────────────────────────────────────────────────── */
function setCorsHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
}

function respond(data) {
  return setCorsHeaders(
    ContentService.createTextOutput(JSON.stringify(data))
  );
}

/* ──────────────────────────────────────────────────────────
   GET — Obtener disponibilidad para una fecha
   Llamado como: ?action=availability&date=2026-05-10
────────────────────────────────────────────────────────── */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'availability') {
    return getAvailability(e.parameter.date);
  }

  if (action === 'ping') {
    return respond({ ok: true, message: 'Lili Makeup API activa ✓' });
  }

  return respond({ error: 'Acción no reconocida' });
}

function getAvailability(dateStr) {
  try {
    // Parsear la fecha recibida (YYYY-MM-DD)
    const parts = dateStr.split('-').map(Number);
    const date  = new Date(parts[0], parts[1] - 1, parts[2]);
    const dow   = date.getDay();  // 0=Dom … 6=Sáb

    // Si es día no laborable, no hay slots
    if (!WORKING_HOURS[dow]) {
      return respond({ available: [], busy: [], workday: false });
    }

    const hours = WORKING_HOURS[dow];

    // Generar todos los slots del día
    const allSlots = [];
    for (let h = hours.start; h < hours.end; h++) {
      allSlots.push(`${String(h).padStart(2,'0')}:00`);
    }

    // Obtener eventos del calendario para ese día
    const cal    = CalendarApp.getCalendarById(CALENDAR_ID);
    const events = cal.getEventsForDay(date);

    // Determinar qué slots están ocupados
    const busySlots = [];
    events.forEach(ev => {
      const evStart = ev.getStartTime();
      const evEnd   = ev.getEndTime();

      allSlots.forEach(slot => {
        const [h, m] = slot.split(':').map(Number);
        const slotStart = new Date(date);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60000);

        // Si el slot se superpone con el evento → ocupado
        if (slotStart < evEnd && slotEnd > evStart) {
          if (!busySlots.includes(slot)) busySlots.push(slot);
        }
      });
    });

    const available = allSlots.filter(s => !busySlots.includes(s));

    return respond({ available, busy: busySlots, workday: true, date: dateStr });

  } catch (err) {
    return respond({ error: err.message });
  }
}

/* ──────────────────────────────────────────────────────────
   POST — Guardar asesoría y crear evento en Google Calendar
────────────────────────────────────────────────────────── */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Validación básica
    if (!data.name || !data.phone || !data.service || !data.date || !data.slot) {
      return respond({ success: false, error: 'Faltan campos requeridos' });
    }

    // 1. Guardar en Google Sheets
    saveToSheet(data);

    // 2. Crear evento en Google Calendar
    createCalendarEvent(data);

    return respond({
      success: true,
      message: '¡Asesoría reservada con éxito!',
    });

  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

/* ──────────────────────────────────────────────────────────
   Guarda una fila en Google Sheets
────────────────────────────────────────────────────────── */
function saveToSheet(data) {
  // Abre el spreadsheet activo (el mismo donde está el script)
  // o usa SpreadsheetApp.openById('ID') para uno específico
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);

  // Crear hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Encabezados
    sheet.appendRow([
      'Fecha Registro', 'Nombre', 'Teléfono', 'Email',
      'Servicio', 'Fecha Cita', 'Hora', 'Notas', 'Estado'
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  }

  sheet.appendRow([
    new Date().toLocaleString('es-CO'),
    data.name,
    data.phone,
    data.email   || '',
    data.service,
    data.date,
    data.slot,
    data.notes   || '',
    'Pendiente',
  ]);
}

/* ──────────────────────────────────────────────────────────
   Crea un evento en Google Calendar
────────────────────────────────────────────────────────── */
function createCalendarEvent(data) {
  const cal = CalendarApp.getCalendarById(CALENDAR_ID);

  const parts = data.date.split('-').map(Number);
  const [h, m] = data.slot.split(':').map(Number);

  const start = new Date(parts[0], parts[1] - 1, parts[2], h, m, 0);
  const end   = new Date(start.getTime() + SLOT_MINUTES * 60000);

  const description = [
    `📞 Asesoría Vía Llamada`,
    ``,
    `👤 Cliente: ${data.name}`,
    `📱 Teléfono: ${data.phone}`,
    `📧 Email: ${data.email || 'N/A'}`,
    `💄 Servicio: ${data.service}`,
    data.notes ? `📝 Notas: ${data.notes}` : '',
  ].filter(Boolean).join('\n');

  cal.createEvent(
    `📞 Asesoría — ${data.name}`,
    start,
    end,
    {
      description,
      location : 'Llamada telefónica',
      sendInvites: false,
    }
  );
}
