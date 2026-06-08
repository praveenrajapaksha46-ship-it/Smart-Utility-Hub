/**
 * Notes System Module
 * Create, edit, delete, search notes with rich text editor
 */

import { showToast, logActivity, formatDateTime, debounce } from './utils.js';

const NOTES_KEY = 'suh_notes';
let notes = [];
let activeNoteId = null;
let searchQuery = '';

/** Initialize notes module */
export function initNotes() {
  notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
  bindEvents();
  renderNotesList();
}

function bindEvents() {
  document.getElementById('newNoteBtn').addEventListener('click', createNote);
  document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
  document.getElementById('deleteNoteBtn').addEventListener('click', deleteNote);
  document.getElementById('noteSearch').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.toLowerCase();
    renderNotesList();
  }, 200));

  // Rich text toolbar commands
  document.querySelectorAll('#noteToolbar button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const value = btn.dataset.value || null;
      document.execCommand(cmd, false, value);
      document.getElementById('noteEditor').focus();
    });
  });
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function createNote() {
  const note = {
    id: Date.now().toString(),
    title: 'Untitled Note',
    content: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
  notes.unshift(note);
  saveNotes();
  selectNote(note.id);
  renderNotesList();
  logActivity('Created new note', 'note-sticky');
  showToast('New note created', 'success');
}

function selectNote(id) {
  activeNoteId = id;
  const note = notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('noteTitle').value = note.title;
  document.getElementById('noteEditor').innerHTML = note.content;
  renderNotesList();
}

function saveNote() {
  if (!activeNoteId) {
    showToast('Select or create a note first', 'error');
    return;
  }

  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;

  note.title = document.getElementById('noteTitle').value || 'Untitled Note';
  note.content = document.getElementById('noteEditor').innerHTML;
  note.updated = new Date().toISOString();
  saveNotes();
  renderNotesList();
  logActivity(`Saved note: ${note.title}`, 'save');
  showToast('Note saved', 'success');
}

function deleteNote() {
  if (!activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  notes = notes.filter(n => n.id !== activeNoteId);
  saveNotes();
  activeNoteId = null;
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteEditor').innerHTML = '';
  renderNotesList();
  logActivity(`Deleted note: ${note?.title}`, 'trash');
  showToast('Note deleted', 'info');
}

function renderNotesList() {
  const list = document.getElementById('notesList');
  let filtered = notes;

  if (searchQuery) {
    filtered = notes.filter(n =>
      n.title.toLowerCase().includes(searchQuery) ||
      n.content.toLowerCase().includes(searchQuery)
    );
  }

  list.innerHTML = filtered.map(note => `
    <li class="${note.id === activeNoteId ? 'active' : ''}" data-id="${note.id}">
      <strong>${escapeHtml(note.title)}</strong>
      <div class="note-date">${formatDateTime(note.updated)}</div>
    </li>
  `).join('') || '<li style="color:var(--text-muted);padding:1rem">No notes found</li>';

  list.querySelectorAll('li[data-id]').forEach(li => {
    li.addEventListener('click', () => selectNote(li.dataset.id));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getNotesStats() {
  const stored = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
  return { noteCount: stored.length };
}
