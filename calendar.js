/**
 * Calendar Module
 * Monthly view, event creation, reminders, event management
 */

import { showToast, logActivity, notify, requestNotificationPermission } from './utils.js';

const EVENTS_KEY = 'suh_events';
let events = [];
let currentDate = new Date();
let selectedDate = new Date().toISOString().split('T')[0];
let reminderInterval = null;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Initialize calendar */
export function initCalendar() {
  events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
  bindEvents();
  renderCalendar();
  renderEvents();
  startReminderCheck();
  requestNotificationPermission();
}

function bindEvents() {
  document.getElementById('calPrev').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addEvent();
  });
}

function saveEvents() {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('calMonthYear').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const grid = document.getElementById('calendarGrid');
  let html = DAY_NAMES.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    html += `<div class="cal-day other-month">${day}</div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEvent = events.some(e => e.date === dateStr);
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;

    html += `<div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEvent ? 'has-event' : ''}" data-date="${dateStr}">${day}</div>`;
  }

  // Next month padding
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month">${i}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day[data-date]').forEach(day => {
    day.addEventListener('click', () => {
      selectedDate = day.dataset.date;
      document.getElementById('eventDate').value = selectedDate;
      renderCalendar();
      renderEvents();
    });
  });
}

function addEvent() {
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const time = document.getElementById('eventTime').value;
  const reminder = document.getElementById('eventReminder').checked;

  if (!title || !date) return;

  const event = {
    id: Date.now().toString(),
    title,
    date,
    time: time || null,
    reminder,
    reminded: false,
    created: new Date().toISOString()
  };

  events.push(event);
  saveEvents();
  document.getElementById('eventForm').reset();
  document.getElementById('eventDate').value = selectedDate;
  renderCalendar();
  renderEvents();
  logActivity(`Added event: ${title}`, 'calendar-plus');
  showToast('Event added', 'success');
}

function deleteEvent(id) {
  const event = events.find(e => e.id === id);
  events = events.filter(e => e.id !== id);
  saveEvents();
  renderCalendar();
  renderEvents();
  logActivity(`Deleted event: ${event?.title}`, 'trash');
  showToast('Event deleted', 'info');
}

function renderEvents() {
  const list = document.getElementById('eventList');
  const filtered = events
    .filter(e => e.date === selectedDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  list.innerHTML = filtered.map(event => `
    <li>
      <i class="fas fa-calendar-check"></i>
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <div class="event-date">${event.time || 'All day'}${event.reminder ? ' · <i class="fas fa-bell"></i>' : ''}</div>
      </div>
      <button class="delete-event" data-id="${event.id}"><i class="fas fa-trash"></i></button>
    </li>
  `).join('') || '<li style="color:var(--text-muted);padding:0.75rem">No events on this date</li>';

  list.querySelectorAll('.delete-event').forEach(btn => {
    btn.addEventListener('click', () => deleteEvent(btn.dataset.id));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Check for event reminders every minute */
function startReminderCheck() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(checkReminders, 60000);
  checkReminders();
}

function checkReminders() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  events.forEach(event => {
    if (event.reminder && !event.reminded && event.date === today && event.time === currentTime) {
      event.reminded = true;
      notify('Event Reminder', event.title);
      showToast(`Reminder: ${event.title}`, 'info');
    }
  });
  saveEvents();
}

export function getCalendarStats() {
  const stored = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
  return { eventCount: stored.length };
}
