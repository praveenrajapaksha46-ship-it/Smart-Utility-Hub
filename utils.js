/**
 * Shared utility functions for Smart Utility Hub
 */

const ACTIVITY_KEY = 'suh_activities';
const MAX_ACTIVITIES = 50;

/** Show toast notification */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
  toast.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** Log user activity for dashboard */
export function logActivity(action, icon = 'circle') {
  const activities = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  activities.unshift({
    action,
    icon,
    time: new Date().toISOString()
  });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, MAX_ACTIVITIES)));
}

/** Get recent activities */
export function getActivities() {
  return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
}

/** Format bytes to human readable */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format seconds to mm:ss */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format date/time for display */
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString();
}

/** Format date only */
export function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Debounce function calls */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Get/set app settings from localStorage */
export function getSettings() {
  return JSON.parse(localStorage.getItem('suh_settings') || '{}');
}

export function saveSettings(settings) {
  const current = getSettings();
  localStorage.setItem('suh_settings', JSON.stringify({ ...current, ...settings }));
}

/** Request notification permission */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

/** Send browser notification if enabled */
export function notify(title, body) {
  const settings = getSettings();
  if (settings.notifications === false) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'assets/favicon.svg' });
  }
}

/** Get file icon class based on mime type */
export function getFileIcon(mime, isFolder = false) {
  if (isFolder) return 'fa-folder';
  if (!mime) return 'fa-file';
  if (mime.startsWith('image/')) return 'fa-file-image';
  if (mime.startsWith('video/')) return 'fa-file-video';
  if (mime.startsWith('audio/')) return 'fa-file-audio';
  if (mime.includes('pdf')) return 'fa-file-pdf';
  if (mime.includes('text') || mime.includes('json')) return 'fa-file-lines';
  if (mime.includes('zip') || mime.includes('archive')) return 'fa-file-zipper';
  return 'fa-file';
}

/** Weather code to icon mapping (WMO codes) */
export function weatherIcon(code) {
  if (code === 0) return 'fa-sun';
  if (code <= 3) return 'fa-cloud-sun';
  if (code <= 48) return 'fa-smog';
  if (code <= 57) return 'fa-cloud-drizzle';
  if (code <= 67) return 'fa-cloud-rain';
  if (code <= 77) return 'fa-snowflake';
  if (code <= 82) return 'fa-cloud-showers-heavy';
  if (code <= 86) return 'fa-snowflake';
  return 'fa-cloud-bolt';
}

/** Weather code description */
export function weatherDesc(code) {
  const desc = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Rain showers',
    81: 'Moderate showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail'
  };
  return desc[code] || 'Unknown';
}
