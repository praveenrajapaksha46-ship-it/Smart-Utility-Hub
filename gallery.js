/**
 * Media Gallery Module
 * Image/video gallery, search, fullscreen viewer
 */

import { dbGetAll, dbPut, dbDelete, generateId } from './db.js';
import { showToast, logActivity, debounce } from './utils.js';

let mediaItems = [];
let currentFilter = 'all';
let searchQuery = '';
let lightboxIndex = 0;
let filteredItems = [];

/** Initialize gallery */
export async function initGallery() {
  mediaItems = await dbGetAll('gallery');
  bindEvents();
  renderGallery();
}

function bindEvents() {
  document.getElementById('galleryUpload').addEventListener('change', handleUpload);
  document.getElementById('gallerySearch').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.toLowerCase();
    renderGallery();
  }, 200));

  document.querySelectorAll('.gallery-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.gallery-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.gallery;
      renderGallery();
    });
  });

  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightboxNext').addEventListener('click', () => navigateLightbox(1));

  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

async function handleUpload(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const item = {
      id: generateId(),
      name: file.name,
      type,
      mime: file.type,
      blob: file,
      size: file.size,
      added: new Date().toISOString()
    };
    await dbPut('gallery', item);
    mediaItems.push(item);
  }
  renderGallery();
  logActivity(`Uploaded ${files.length} media file(s)`, 'images');
  showToast(`${files.length} media file(s) added`, 'success');
  e.target.value = '';
}

function getFilteredItems() {
  let items = mediaItems;
  if (currentFilter !== 'all') items = items.filter(m => m.type === currentFilter);
  if (searchQuery) items = items.filter(m => m.name.toLowerCase().includes(searchQuery));
  return items;
}

function renderGallery() {
  filteredItems = getFilteredItems();
  const grid = document.getElementById('galleryGrid');

  grid.innerHTML = filteredItems.map((item, i) => {
    const url = URL.createObjectURL(item.blob);
    const thumb = item.type === 'video'
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}" alt="${item.name}" loading="lazy">`;

    return `
      <div class="gallery-item" data-index="${i}">
        ${thumb}
        <span class="media-type">${item.type}</span>
        <button class="delete-media" data-id="${item.id}"><i class="fas fa-times"></i></button>
      </div>
    `;
  }).join('') || '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem">No media files yet</p>';

  grid.querySelectorAll('.gallery-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.delete-media')) return;
      openLightbox(parseInt(el.dataset.index));
    });
  });

  grid.querySelectorAll('.delete-media').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteMedia(btn.dataset.id);
    });
  });
}

async function deleteMedia(id) {
  await dbDelete('gallery', id);
  mediaItems = mediaItems.filter(m => m.id !== id);
  renderGallery();
  showToast('Media deleted', 'info');
}

function openLightbox(index) {
  lightboxIndex = index;
  const lb = document.getElementById('lightbox');
  lb.hidden = false;
  updateLightboxContent();
}

function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.getElementById('lightboxContent').innerHTML = '';
}

function navigateLightbox(dir) {
  lightboxIndex = (lightboxIndex + dir + filteredItems.length) % filteredItems.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const item = filteredItems[lightboxIndex];
  if (!item) return;

  const url = URL.createObjectURL(item.blob);
  const content = document.getElementById('lightboxContent');

  if (item.type === 'video') {
    content.innerHTML = `<video src="${url}" controls autoplay></video>`;
  } else {
    content.innerHTML = `<img src="${url}" alt="${item.name}">`;
  }
}

export async function getGalleryStats() {
  const items = mediaItems.length ? mediaItems : await dbGetAll('gallery');
  return {
    total: items.length,
    images: items.filter(m => m.type === 'image').length,
    videos: items.filter(m => m.type === 'video').length
  };
}
