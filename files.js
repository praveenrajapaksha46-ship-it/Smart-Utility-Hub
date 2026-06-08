/**
 * File Manager Module
 * Upload, download, folders, preview, search, drag-drop, IndexedDB storage
 */

import { dbGetAll, dbPut, dbDelete, generateId, getStorageStats } from './db.js';
import { showToast, logActivity, formatBytes, getFileIcon, debounce } from './utils.js';

let currentFolder = 'root';
let allFiles = [];
let searchQuery = '';

const ROOT_ID = 'root';
const MAX_STORAGE = 500 * 1024 * 1024; // 500MB soft limit display

/** Initialize file manager */
export async function initFiles() {
  await ensureRootFolder();
  await loadFiles();
  bindEvents();
  updateStorageBar();
}

async function ensureRootFolder() {
  const files = await dbGetAll('files');
  if (!files.find(f => f.id === ROOT_ID)) {
    await dbPut('files', { id: ROOT_ID, name: 'Root', type: 'folder', parentId: null, created: new Date().toISOString() });
  }
}

function bindEvents() {
  document.getElementById('newFolderBtn').addEventListener('click', createFolder);
  document.getElementById('fileUpload').addEventListener('change', (e) => handleUpload(e.target.files));
  document.getElementById('fileSearch').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.toLowerCase();
    renderFiles();
  }, 200));

  const dropZone = document.getElementById('fileDropZone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleUpload(e.dataTransfer.files);
  });

  document.querySelector('#filePreviewModal [data-close-modal]').addEventListener('click', () => {
    document.getElementById('filePreviewModal').hidden = true;
  });
}

async function loadFiles() {
  allFiles = await dbGetAll('files');
  renderBreadcrumb();
  renderFiles();
}

function getChildren(parentId) {
  return allFiles.filter(f => f.parentId === parentId && f.id !== ROOT_ID);
}

function renderBreadcrumb() {
  const bc = document.getElementById('fileBreadcrumb');
  const path = [];
  let id = currentFolder;
  while (id) {
    const folder = allFiles.find(f => f.id === id);
    if (folder) path.unshift(folder);
    id = folder?.parentId;
  }

  bc.innerHTML = path.map((f, i) => {
    if (i === path.length - 1) return `<span>${f.name}</span>`;
    return `<button data-folder="${f.id}">${f.name}</button> <span>/</span> `;
  }).join('');

  bc.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.folder));
  });
}

function navigateTo(folderId) {
  currentFolder = folderId;
  renderBreadcrumb();
  renderFiles();
}

function renderFiles() {
  const grid = document.getElementById('fileGrid');
  let items = getChildren(currentFolder);

  if (searchQuery) {
    items = allFiles.filter(f =>
      f.id !== ROOT_ID && f.name.toLowerCase().includes(searchQuery)
    );
  }

  items.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  grid.innerHTML = items.map(item => `
    <div class="file-item ${item.type}" data-id="${item.id}" data-type="${item.type}">
      <i class="fas ${getFileIcon(item.mime, item.type === 'folder')}"></i>
      <span>${item.name}</span>
      <div class="file-actions">
        ${item.type !== 'folder' ? '<button class="download-btn" title="Download"><i class="fas fa-download"></i></button>' : ''}
        ${item.type !== 'folder' ? '<button class="preview-btn" title="Preview"><i class="fas fa-eye"></i></button>' : ''}
        <button class="delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('') || '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">No files in this folder</p>';

  grid.querySelectorAll('.file-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.file-actions')) return;
      if (el.dataset.type === 'folder') navigateTo(el.dataset.id);
    });

    el.querySelector('.download-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadFile(el.dataset.id);
    });
    el.querySelector('.preview-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      previewFile(el.dataset.id);
    });
    el.querySelector('.delete-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteFile(el.dataset.id);
    });
  });
}

async function createFolder() {
  const name = prompt('Folder name:');
  if (!name?.trim()) return;

  const folder = {
    id: generateId(),
    name: name.trim(),
    type: 'folder',
    parentId: currentFolder,
    created: new Date().toISOString()
  };
  await dbPut('files', folder);
  allFiles.push(folder);
  renderFiles();
  logActivity(`Created folder: ${name}`, 'folder-plus');
  showToast(`Folder "${name}" created`, 'success');
}

async function handleUpload(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    const item = {
      id: generateId(),
      name: file.name,
      type: 'file',
      mime: file.type,
      size: file.size,
      blob: file,
      parentId: currentFolder,
      created: new Date().toISOString()
    };
    await dbPut('files', item);
    allFiles.push(item);
  }
  renderFiles();
  updateStorageBar();
  logActivity(`Uploaded ${files.length} file(s)`, 'upload');
  showToast(`${files.length} file(s) uploaded`, 'success');
}

async function downloadFile(id) {
  const file = allFiles.find(f => f.id === id);
  if (!file?.blob) return;

  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  logActivity(`Downloaded: ${file.name}`, 'download');
}

function previewFile(id) {
  const file = allFiles.find(f => f.id === id);
  if (!file?.blob) return;

  const modal = document.getElementById('filePreviewModal');
  const content = document.getElementById('filePreviewContent');
  const url = URL.createObjectURL(file.blob);

  if (file.mime?.startsWith('image/')) {
    content.innerHTML = `<img src="${url}" alt="${file.name}" style="max-width:100%">`;
  } else if (file.mime?.startsWith('video/')) {
    content.innerHTML = `<video src="${url}" controls style="max-width:100%"></video>`;
  } else if (file.mime?.startsWith('text/') || file.mime === 'application/json') {
    const reader = new FileReader();
    reader.onload = () => {
      content.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-word">${escapeHtml(reader.result)}</pre>`;
    };
    reader.readAsText(file.blob);
  } else {
    content.innerHTML = `<p>Preview not available for this file type.</p><p><strong>${file.name}</strong> (${formatBytes(file.size)})</p>`;
  }

  modal.hidden = false;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deleteFile(id) {
  const file = allFiles.find(f => f.id === id);
  if (!file) return;

  if (file.type === 'folder') {
    const children = allFiles.filter(f => f.parentId === id);
    for (const child of children) await deleteFile(child.id);
  }

  await dbDelete('files', id);
  allFiles = allFiles.filter(f => f.id !== id);
  renderFiles();
  updateStorageBar();
  showToast('Deleted successfully', 'info');
}

async function updateStorageBar() {
  const stats = await getStorageStats();
  const pct = Math.min((stats.totalBytes / MAX_STORAGE) * 100, 100);
  document.getElementById('storageFill').style.width = `${pct}%`;
  document.getElementById('storageText').textContent = `${formatBytes(stats.totalBytes)} / ${formatBytes(MAX_STORAGE)}`;
}

export async function getFileStats() {
  const stats = await getStorageStats();
  return stats;
}
