/**
 * Settings Module
 * Theme, language, preferences, data management
 */

import { showToast, logActivity, getSettings, saveSettings } from './utils.js';
import { setLanguage, applyTranslations } from './i18n.js';
import { dbClear } from './db.js';

/** Initialize settings */
export function initSettings() {
  const settings = getSettings();
  bindEvents();
  applySettings(settings);
}

function bindEvents() {
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    applyTheme(e.target.value);
    saveSettings({ theme: e.target.value });
    logActivity(`Theme changed to ${e.target.value}`, 'palette');
  });

  document.getElementById('accentColor').addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--accent', e.target.value);
    saveSettings({ accent: e.target.value });
  });

  document.getElementById('languageSelect').addEventListener('change', (e) => {
    setLanguage(e.target.value);
    logActivity(`Language changed to ${e.target.value}`, 'language');
    showToast('Language updated', 'success');
  });

  document.getElementById('animationsToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('no-animations', !e.target.checked);
    saveSettings({ animations: e.target.checked });
  });

  document.getElementById('notificationsToggle').addEventListener('change', (e) => {
    saveSettings({ notifications: e.target.checked });
  });

  document.getElementById('themeToggle').addEventListener('click', toggleThemeQuick);

  document.getElementById('exportData').addEventListener('click', exportAllData);
  document.getElementById('clearAllData').addEventListener('click', clearAllData);
}

function applySettings(settings) {
  if (settings.theme) applyTheme(settings.theme);
  if (settings.accent) document.documentElement.style.setProperty('--accent', settings.accent);
  if (settings.language) {
    document.getElementById('languageSelect').value = settings.language;
    setLanguage(settings.language);
  }
  if (settings.animations === false) document.body.classList.add('no-animations');
  if (settings.notifications === false) document.getElementById('notificationsToggle').checked = false;
  if (settings.accent) document.getElementById('accentColor').value = settings.accent;
  if (settings.theme) document.getElementById('themeSelect').value = settings.theme;
}

/** Apply theme (dark, light, or auto) */
export function applyTheme(theme) {
  let resolved = theme;
  if (theme === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);

  const icon = document.querySelector('#themeToggle i');
  icon.className = resolved === 'dark' ? 'fas fa-moon' : 'fas fa-sun';

  // Update chart colors if Chart.js is loaded
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = resolved === 'dark' ? '#94a3b8' : '#475569';
  }
}

function toggleThemeQuick() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  document.getElementById('themeSelect').value = next;
  saveSettings({ theme: next });
}

/** Export all localStorage data as JSON */
function exportAllData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('suh_')) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart-utility-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  logActivity('Exported app data', 'file-export');
  showToast('Data exported successfully', 'success');
}

/** Clear all app data */
async function clearAllData() {
  if (!confirm('Are you sure you want to delete ALL app data? This cannot be undone.')) return;

  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('suh_')) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));

  await dbClear('files');
  await dbClear('music');
  await dbClear('gallery');

  logActivity('Cleared all app data', 'trash');
  showToast('All data cleared. Reloading...', 'info');
  setTimeout(() => location.reload(), 1500);
}

/** Load saved theme on startup */
export function loadTheme() {
  const settings = getSettings();
  applyTheme(settings.theme || 'dark');
}
