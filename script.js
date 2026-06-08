/**
 * Smart Utility Hub - Main Application Entry Point
 * Orchestrates navigation, module initialization, and global app state
 */

import { applyTranslations, t } from './i18n.js';
import { loadTheme } from './settings.js';
import { initSettings } from './settings.js';
import { initLocation, refreshMap } from './location.js';
import { initMusic } from './music.js';
import { initFiles } from './files.js';
import { initNotes } from './notes.js';
import { initTasks } from './tasks.js';
import { initCalendar } from './calendar.js';
import { initWeather } from './weather.js';
import { initGallery } from './gallery.js';
import { initQR, startScanner, stopScanner } from './qr.js';
import { initDashboard, refreshDashboard } from './dashboard.js';
import { logActivity, showToast } from './utils.js';
import { openDB } from './db.js';

// Track which modules have been initialized (lazy loading)
const initialized = new Set();
let currentSection = 'dashboard';

/** Application bootstrap */
async function initApp() {
  try {
    // Initialize IndexedDB
    await openDB();

    // Apply saved theme and translations
    loadTheme();
    applyTranslations();

    // Setup navigation and UI
    setupNavigation();
    setupSidebar();

    // Initialize settings (always needed)
    initSettings();

    // Initialize dashboard (default view)
    await initDashboard();
    initialized.add('dashboard');

    // Initialize location (for share link support)
    initLocation();
    initialized.add('location');

    // Log app start
    logActivity('Opened Smart Utility Hub', 'bolt');
    showToast('Welcome to Smart Utility Hub!', 'success');

    // Handle initial hash navigation
    const hash = window.location.hash.replace('#', '');
    if (hash && document.querySelector(`[data-section="${hash}"]`)) {
      navigateTo(hash);
    }
  } catch (err) {
    console.error('App initialization failed:', err);
    showToast('Failed to initialize app', 'error');
  }
}

/** Setup sidebar navigation clicks */
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });

  // Custom navigate event from other modules
  window.addEventListener('navigate', (e) => navigateTo(e.detail));

  // Browser back/forward
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) navigateTo(hash, false);
  });
}

/** Navigate to a section */
async function navigateTo(section, updateHash = true) {
  if (!section) return;
  currentSection = section;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Show correct section
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.toggle('active', sec.dataset.section === section);
  });

  // Update page title
  const titleKey = `nav.${section}`;
  const title = t(titleKey);
  document.getElementById('pageTitle').textContent = title;
  document.title = `${title} - Smart Utility Hub`;

  // Update URL hash
  if (updateHash) window.location.hash = section;

  // Close mobile sidebar
  closeSidebar();

  // Lazy-init module on first visit
  await lazyInitModule(section);

  // Section-specific refresh hooks
  if (section === 'dashboard') await refreshDashboard();
  if (section === 'location') refreshMap();
  if (section === 'qr') await startScanner();
  else await stopScanner();
}

/** Lazy initialize modules when first accessed */
async function lazyInitModule(section) {
  if (initialized.has(section)) return;

  switch (section) {
    case 'music':
      await initMusic();
      break;
    case 'files':
      await initFiles();
      break;
    case 'notes':
      initNotes();
      break;
    case 'tasks':
      initTasks();
      break;
    case 'calendar':
      initCalendar();
      break;
    case 'weather':
      initWeather();
      break;
    case 'gallery':
      await initGallery();
      break;
    case 'qr':
      initQR();
      break;
  }

  initialized.add(section);
}

/** Mobile sidebar toggle */
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  document.getElementById('menuToggle').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  });

  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
