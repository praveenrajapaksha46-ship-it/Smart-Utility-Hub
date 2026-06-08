/**
 * Dashboard Module
 * Activity statistics, charts, shortcuts, recent actions
 */

import { getActivities, formatBytes, formatDateTime } from './utils.js';
import { t } from './i18n.js';
import { getLocationStats } from './location.js';
import { getMusicStats } from './music.js';
import { getFileStats } from './files.js';
import { getNotesStats } from './notes.js';
import { getTaskStats } from './tasks.js';
import { getCalendarStats } from './calendar.js';
import { getGalleryStats } from './gallery.js';

let activityChart = null;
let storageChart = null;

const SHORTCUTS = [
  { section: 'location', icon: 'location-dot', label: 'Location' },
  { section: 'music', icon: 'music', label: 'Music' },
  { section: 'files', icon: 'folder-open', label: 'Files' },
  { section: 'notes', icon: 'note-sticky', label: 'Notes' },
  { section: 'tasks', icon: 'list-check', label: 'Tasks' },
  { section: 'weather', icon: 'cloud-sun', label: 'Weather' },
  { section: 'gallery', icon: 'images', label: 'Gallery' },
  { section: 'qr', icon: 'qrcode', label: 'QR Tools' }
];

/** Initialize dashboard */
export async function initDashboard() {
  await refreshDashboard();
}

/** Refresh all dashboard widgets */
export async function refreshDashboard() {
  await renderStats();
  renderShortcuts();
  renderRecentActions();
  renderCharts();
}

async function renderStats() {
  const loc = getLocationStats();
  const music = await getMusicStats();
  const files = await getFileStats();
  const notes = getNotesStats();
  const tasks = getTaskStats();
  const calendar = getCalendarStats();
  const gallery = await getGalleryStats();

  const stats = [
    { icon: 'list-check', label: 'Active Tasks', value: tasks.active, color: '#6366f1' },
    { icon: 'note-sticky', label: 'Notes', value: notes.noteCount, color: '#8b5cf6' },
    { icon: 'music', label: 'Tracks', value: music.trackCount, color: '#d946ef' },
    { icon: 'images', label: 'Media', value: gallery.total, color: '#22c55e' },
    { icon: 'folder-open', label: 'Files', value: files.fileCount, color: '#f59e0b' },
    { icon: 'calendar-days', label: 'Events', value: calendar.eventCount, color: '#3b82f6' },
    { icon: 'location-dot', label: 'Loc Points', value: loc.historyCount, color: '#ef4444' },
    { icon: 'hard-drive', label: 'Storage', value: formatBytes(files.totalBytes), color: '#64748b' }
  ];

  document.getElementById('dashboardStats').innerHTML = stats.map(s => `
    <div class="stat-card glass">
      <div class="stat-icon" style="background:linear-gradient(135deg,${s.color},${s.color}88)">
        <i class="fas fa-${s.icon}"></i>
      </div>
      <div class="stat-info">
        <span>${s.label}</span>
        <strong>${s.value}</strong>
      </div>
    </div>
  `).join('');
}

function renderShortcuts() {
  const grid = document.getElementById('shortcutsGrid');
  grid.innerHTML = SHORTCUTS.map(s => `
    <button class="shortcut-btn" data-section="${s.section}">
      <i class="fas fa-${s.icon}"></i>
      <span>${s.label}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.section }));
    });
  });
}

function renderRecentActions() {
  const activities = getActivities();
  const list = document.getElementById('recentActions');

  list.innerHTML = activities.slice(0, 10).map(a => `
    <li>
      <i class="fas fa-${a.icon}"></i>
      <span>${a.action}</span>
      <span class="time">${formatDateTime(a.time)}</span>
    </li>
  `).join('') || '<li style="color:var(--text-muted)">No recent activity</li>';
}

async function renderCharts() {
  const tasks = getTaskStats();
  const notes = getNotesStats();
  const music = await getMusicStats();
  const gallery = await getGalleryStats();
  const calendar = getCalendarStats();
  const files = await getFileStats();

  // Activity bar chart
  const actCtx = document.getElementById('activityChart');
  if (activityChart) activityChart.destroy();
  activityChart = new Chart(actCtx, {
    type: 'bar',
    data: {
      labels: ['Tasks', 'Notes', 'Music', 'Gallery', 'Events', 'Files'],
      datasets: [{
        label: 'Count',
        data: [tasks.total, notes.noteCount, music.trackCount, gallery.total, calendar.eventCount, files.fileCount],
        backgroundColor: ['#6366f1', '#8b5cf6', '#d946ef', '#22c55e', '#3b82f6', '#f59e0b'],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      }
    }
  });

  // Storage doughnut chart
  const storCtx = document.getElementById('storageChart');
  if (storageChart) storageChart.destroy();

  const musicSize = files.totalBytes * 0.3; // approximate breakdown for viz
  const gallerySize = files.totalBytes * 0.4;
  const fileSize = files.totalBytes * 0.3;

  storageChart = new Chart(storCtx, {
    type: 'doughnut',
    data: {
      labels: ['Files', 'Music', 'Gallery'],
      datasets: [{
        data: [fileSize || 1, musicSize || 1, gallerySize || 1],
        backgroundColor: ['#6366f1', '#d946ef', '#22c55e'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16 } }
      },
      cutout: '65%'
    }
  });
}
