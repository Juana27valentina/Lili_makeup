/**
 * booking.js — Lili Makeup · Asesoría Vía Llamada
 * Google Apps Script backend → disponibilidad en tiempo real
 */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────── */
  const WA_NUMBER = '3113178349';

  /**
   * Pega aquí la URL de tu Google Apps Script después de desplegarlo.
   * Ejemplo: 'https://script.google.com/macros/s/XXXXXXXXX/exec'
   * Deja vacío para funcionar en modo offline (sin disponibilidad en tiempo real).
   */
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwF1cI8mE4sIqPzK5X7bCqFf2V-wV1tQd8xY3t8Z1P/exec';   // ← PEGA TU URL AQUÍ

  const DURATION_H  = 1;
  const EVENT_TITLE = 'Asesoría Vía Llamada — Lili Makeup';

  /* Horarios por defecto (usados si no hay backend conectado) */
  const DEFAULT_SLOTS = [
    '08:00','09:00','10:00','11:00','12:00',
    '13:00','14:00','15:00','16:00','17:00',
  ];

  /* ── State ──────────────────────────────────────── */
  let curYear, curMonth, selDate, selSlot;
  let availabilityCache = {}; // { 'YYYY-MM-DD': ['08:00', ...] }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ── Refs ───────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  const sCalendar = $('bcs-calendar');
  const sSlots    = $('bcs-slots');
  const sForm     = $('bcs-form');
  const sSuccess  = $('bcs-success');

  /* ── Helpers ────────────────────────────────────── */
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const WEEK   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

  function show(el) {
    [sCalendar, sSlots, sForm, sSuccess].forEach(s => s.classList.add('hidden'));
    el.classList.remove('hidden');
  }

  function toDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function isWorkday(d) { return d >= today && d.getDay() !== 0; }
  function isToday(d)   {
    return d.getFullYear() === today.getFullYear()
        && d.getMonth()    === today.getMonth()
        && d.getDate()     === today.getDate();
  }
  function longDate(d) {
    const w = WEEK[d.getDay()];
    return `${w[0].toUpperCase()}${w.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  /* ── Availability (Google Apps Script) ─────────── */
  async function fetchAvailability(date) {
    const key = toDateKey(date);
    if (availabilityCache[key]) return availabilityCache[key];
    if (!APPS_SCRIPT_URL) {
      availabilityCache[key] = DEFAULT_SLOTS;
      return DEFAULT_SLOTS;
    }
    try {
      const res  = await fetch(`${APPS_SCRIPT_URL}?action=availability&date=${key}`);
      const json = await res.json();
      const slots = json.available || DEFAULT_SLOTS;
      availabilityCache[key] = slots;
      return slots;
    } catch (_) {
      availabilityCache[key] = DEFAULT_SLOTS;
      return DEFAULT_SLOTS;
    }
  }

  /* ── Calendar ───────────────────────────────────── */
  function renderCal(y, m) {
    curYear = y; curMonth = m;
    $('cal-month-label').textContent = `${MONTHS[m].toLowerCase()} ${y}`;
    const grid  = $('cal-days');
    grid.innerHTML = '';

    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < first; i++) {
      const b = document.createElement('button');
      b.className = 'cal-day cal-blank'; b.disabled = true;
      grid.appendChild(b);
    }

    for (let d = 1; d <= total; d++) {
      const date = new Date(y, m, d);
      const b    = document.createElement('button');
      b.type = 'button';
      b.textContent = d;

      const cls = ['cal-day'];
      if (!isWorkday(date)) {
        cls.push('cal-disabled'); b.disabled = true;
      } else {
        cls.push('cal-available');
        if (isToday(date))  cls.push('cal-today');
        if (selDate && date.toDateString() === selDate.toDateString()) cls.push('cal-selected');
        b.addEventListener('click', () => pickDate(date, b));
      }
      b.className = cls.join(' ');
      grid.appendChild(b);
    }
    $('cal-prev').disabled = (y === today.getFullYear() && m === today.getMonth());
  }

  async function pickDate(date, btn) {
    selDate = date;
    document.querySelectorAll('.cal-day').forEach(b => b.classList.remove('cal-selected'));
    btn.classList.add('cal-selected');

    // Show loading state in slots
    show(sSlots);
    $('slot-date-label').textContent = longDate(date);
    const grid = $('slots-grid');
    grid.innerHTML = '<p class="slots-loading">Verificando disponibilidad...</p>';

    const slots = await fetchAvailability(date);
    renderSlots(slots);
  }

  /* ── Slots ──────────────────────────────────────── */
  function renderSlots(slots) {
    const grid = $('slots-grid');
    grid.innerHTML = '';

    if (!slots.length) {
      grid.innerHTML = '<p class="slots-empty">No hay horarios disponibles para este día.<br>Por favor elige otra fecha.</p>';
      return;
    }

    slots.forEach(time => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot-btn';
      b.textContent = time;
      b.addEventListener('click', () => pickSlot(time, b));
      grid.appendChild(b);
    });
  }

  function pickSlot(time, btn) {
    selSlot = time;
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    $('form-datetime-label').textContent = `${longDate(selDate)} · ${time}`;
    show(sForm);
  }

  /* ── Form submit ────────────────────────────────── */
  $('booking-form').addEventListener('submit', async e => {
    e.preventDefault();

    const btn = $('booking-form').querySelector('.bc-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const name    = $('bf-name').value.trim();
    const phone   = $('bf-phone').value.trim();
    const email   = $('bf-email').value.trim();
    const service = $('bf-service').value;
    const notes   = $('bf-notes').value.trim();
    const dateKey = toDateKey(selDate);

    const payload = { name, phone, email, service, date: dateKey, slot: selSlot, notes };

    /* Send to Google Apps Script */
    if (APPS_SCRIPT_URL) {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method : 'POST',
          mode   : 'no-cors',   // Apps Script no devuelve CORS headers en POST
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload),
        });
        // Invalidate cache for this date (slot now taken)
        delete availabilityCache[dateKey];
      } catch (_) { /* continúa igual aunque falle la red */ }
    }

    /* Build Google Calendar link (para que Lili también lo añada) */
    const [hh, mm] = selSlot.split(':').map(Number);
    const start = new Date(selDate); start.setHours(hh, mm, 0, 0);
    const end   = new Date(start.getTime() + DURATION_H * 3600000);
    const fmt   = d => d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');

    const details = [
      `Asesoría Vía Llamada`,
      `Servicio: ${service}`,
      `Cliente: ${name}`,
      `Tel: ${phone}`,
      email ? `Email: ${email}` : '',
      notes ? `Notas: ${notes}` : '',
    ].filter(Boolean).join('\n');

    $('gcal-link').href = `https://calendar.google.com/calendar/render?action=TEMPLATE`
      + `&text=${encodeURIComponent(EVENT_TITLE)}`
      + `&dates=${fmt(start)}/${fmt(end)}`
      + `&details=${encodeURIComponent(details)}`
      + `&location=${encodeURIComponent('Llamada telefónica')}&sf=true&output=xml`;

    /* WhatsApp confirmation */
    const msg = `¡Hola Lili! 👋 Quiero confirmar mi asesoría vía llamada:\n\n`
      + `📅 *Fecha:* ${longDate(selDate)}\n`
      + `🕐 *Hora:* ${selSlot}\n`
      + `💄 *Servicio:* ${service}\n`
      + `👤 *Nombre:* ${name}\n`
      + `📞 *Tel:* ${phone}`
      + (email ? `\n📧 *Email:* ${email}` : '')
      + (notes  ? `\n📝 *Notas:* ${notes}` : '');

    $('wa-confirm-link').href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
    $('success-summary').textContent = `${service} · ${longDate(selDate)} a las ${selSlot}.`;

    show(sSuccess);
    $('booking-form').reset();
    btn.disabled = false;
    btn.textContent = 'Reservar Asesoría';
  });

  /* ── Navigation ─────────────────────────────────── */
  $('cal-prev').addEventListener('click', () => {
    let m = curMonth - 1, y = curYear;
    if (m < 0) { m = 11; y--; }
    renderCal(y, m);
  });
  $('cal-next').addEventListener('click', () => {
    let m = curMonth + 1, y = curYear;
    if (m > 11) { m = 0; y++; }
    renderCal(y, m);
  });

  $('slot-back').addEventListener('click', () => show(sCalendar));
  $('form-back').addEventListener('click', () => show(sSlots));
  $('success-reset').addEventListener('click', () => {
    selDate = null; selSlot = null;
    renderCal(today.getFullYear(), today.getMonth());
    show(sCalendar);
  });

  /* ── Init ───────────────────────────────────────── */
  renderCal(today.getFullYear(), today.getMonth());

})();
