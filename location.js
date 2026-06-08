/**
 * Live Location Tracking Module
 * GPS tracking, Leaflet map, share links, location history
 */

import { showToast, logActivity, formatDateTime } from './utils.js';
import { generateId } from './db.js';

const HISTORY_KEY = 'suh_loc_history';
const SHARE_PREFIX = 'suh_share_';

let map = null;
let marker = null;
let pathLayer = null;
let watchId = null;
let shareId = null;
let sharePollInterval = null;
let pathCoords = [];

/** Initialize location module */
export function initLocation() {
  initMap();
  bindEvents();
  checkShareView();
}

/** Initialize Leaflet map */
function initMap() {
  const defaultCenter = [40.7128, -74.006];
  map = L.map('locationMap', { zoomControl: true }).setView(defaultCenter, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  marker = L.marker(defaultCenter).addTo(map);
  pathLayer = L.polyline([], { color: '#6366f1', weight: 3, opacity: 0.7 }).addTo(map);

  // Fix map size when section becomes visible
  setTimeout(() => map.invalidateSize(), 300);
}

function bindEvents() {
  document.getElementById('startTracking').addEventListener('click', startTracking);
  document.getElementById('stopTracking').addEventListener('click', stopTracking);
  document.getElementById('shareLocation').addEventListener('click', createShareLink);
  document.getElementById('copyShareLink').addEventListener('click', copyShareLink);
  document.getElementById('clearLocHistory').addEventListener('click', clearHistory);
}

/** Start GPS watch */
function startTracking() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  document.getElementById('startTracking').disabled = true;
  document.getElementById('stopTracking').disabled = false;
  pathCoords = [];

  watchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onPositionError,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );

  logActivity('Started location tracking', 'location-dot');
  showToast('Location tracking started', 'success');
}

/** Stop GPS watch */
function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  document.getElementById('startTracking').disabled = false;
  document.getElementById('stopTracking').disabled = true;
  logActivity('Stopped location tracking', 'stop');
  showToast('Location tracking stopped', 'info');
}

/** Handle position update */
function onPositionUpdate(pos) {
  const { latitude, longitude, accuracy, speed } = pos.coords;
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  const acc = `${accuracy.toFixed(0)} m`;
  const spd = speed !== null ? `${(speed * 3.6).toFixed(1)} km/h` : '—';

  document.getElementById('locLat').textContent = lat;
  document.getElementById('locLng').textContent = lng;
  document.getElementById('locAccuracy').textContent = acc;
  document.getElementById('locSpeed').textContent = spd;

  const coord = [latitude, longitude];
  marker.setLatLng(coord);
  map.panTo(coord);

  pathCoords.push(coord);
  pathLayer.setLatLngs(pathCoords);

  // Save to history
  const entry = { lat: latitude, lng: longitude, accuracy, speed, time: new Date().toISOString() };
  saveHistoryEntry(entry);
  updateHistoryTable();

  // Update share data if active
  if (shareId) {
    const shareData = {
      lat: latitude, lng: longitude, accuracy, speed,
      time: entry.time, history: pathCoords.slice(-50)
    };
    localStorage.setItem(SHARE_PREFIX + shareId, JSON.stringify(shareData));
  }
}

function onPositionError(err) {
  showToast(`Location error: ${err.message}`, 'error');
  stopTracking();
}

/** Save location to history (max 100 entries) */
function saveHistoryEntry(entry) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

function getHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

function updateHistoryTable() {
  const tbody = document.querySelector('#locHistoryTable tbody');
  const history = getHistory().slice(0, 20);
  tbody.innerHTML = history.map(h => `
    <tr>
      <td>${formatDateTime(h.time)}</td>
      <td>${h.lat.toFixed(6)}</td>
      <td>${h.lng.toFixed(6)}</td>
      <td>${h.speed !== null ? (h.speed * 3.6).toFixed(1) + ' km/h' : '—'}</td>
      <td>${h.accuracy.toFixed(0)} m</td>
    </tr>
  `).join('');
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  updateHistoryTable();
  showToast('Location history cleared', 'info');
}

/** Create shareable tracking link */
function createShareLink() {
  shareId = generateId();
  const url = `${window.location.origin}${window.location.pathname}?track=${shareId}`;
  document.getElementById('shareLinkInput').value = url;
  document.getElementById('shareBox').hidden = false;

  // Store initial share data
  const lat = document.getElementById('locLat').textContent;
  const lng = document.getElementById('locLng').textContent;
  if (lat !== '—') {
    localStorage.setItem(SHARE_PREFIX + shareId, JSON.stringify({
      lat: parseFloat(lat), lng: parseFloat(lng),
      time: new Date().toISOString(), history: pathCoords
    }));
  }

  logActivity('Created location share link', 'share-nodes');
  showToast('Share link created! Works across tabs on this device.', 'success');
}

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Link copied to clipboard', 'success');
  });
}

/** Check if viewing a shared location */
function checkShareView() {
  const params = new URLSearchParams(window.location.search);
  const trackId = params.get('track');
  if (!trackId) {
    updateHistoryTable();
    return;
  }

  // Switch to location section
  window.dispatchEvent(new CustomEvent('navigate', { detail: 'location' }));

  sharePollInterval = setInterval(() => {
    const data = localStorage.getItem(SHARE_PREFIX + trackId);
    if (data) {
      const parsed = JSON.parse(data);
      updateSharedView(parsed);
    }
  }, 2000);

  const data = localStorage.getItem(SHARE_PREFIX + trackId);
  if (data) updateSharedView(JSON.parse(data));

  showToast('Viewing shared location (live updates via polling)', 'info');
}

function updateSharedView(data) {
  document.getElementById('locLat').textContent = data.lat.toFixed(6);
  document.getElementById('locLng').textContent = data.lng.toFixed(6);
  document.getElementById('locAccuracy').textContent = data.accuracy ? `${data.accuracy.toFixed(0)} m` : '—';
  document.getElementById('locSpeed').textContent = data.speed !== null ? `${(data.speed * 3.6).toFixed(1)} km/h` : '—';

  const coord = [data.lat, data.lng];
  marker.setLatLng(coord);
  map.setView(coord, 15);

  if (data.history?.length) {
    pathLayer.setLatLngs(data.history);
  }
}

/** Refresh map when section is shown */
export function refreshMap() {
  if (map) {
    setTimeout(() => map.invalidateSize(), 100);
  }
}

export function getLocationStats() {
  return { historyCount: getHistory().length, tracking: watchId !== null };
}
