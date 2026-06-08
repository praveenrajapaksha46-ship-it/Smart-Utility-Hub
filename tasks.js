/**
 * Task Manager Module
 * Add, edit, delete, complete tasks with priorities and filters
 */

import { showToast, logActivity } from './utils.js';

const TASKS_KEY = 'suh_tasks';
let tasks = [];
let currentFilter = 'all';

/** Initialize task manager */
export function initTasks() {
  tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
  bindEvents();
  renderTasks();
}

function bindEvents() {
  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addTask();
  });

  document.querySelectorAll('.filter-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTasks();
    });
  });
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) return;

  const task = {
    id: Date.now().toString(),
    text,
    priority: document.getElementById('taskPriority').value,
    completed: false,
    created: new Date().toISOString()
  };

  tasks.unshift(task);
  saveTasks();
  input.value = '';
  renderTasks();
  logActivity(`Added task: ${text}`, 'plus');
  showToast('Task added', 'success');
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
  logActivity(task.completed ? `Completed: ${task.text}` : `Reopened: ${task.text}`, 'check');
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const newText = prompt('Edit task:', task.text);
  if (newText?.trim()) {
    task.text = newText.trim();
    saveTasks();
    renderTasks();
    showToast('Task updated', 'success');
  }
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
  logActivity(`Deleted task: ${task?.text}`, 'trash');
  showToast('Task deleted', 'info');
}

function renderTasks() {
  const list = document.getElementById('taskList');
  let filtered = tasks;

  if (currentFilter === 'active') filtered = tasks.filter(t => !t.completed);
  else if (currentFilter === 'completed') filtered = tasks.filter(t => t.completed);

  // Sort: incomplete first, then by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  list.innerHTML = filtered.map(task => `
    <li class="${task.completed ? 'completed' : ''}">
      <input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
      <span class="priority-badge priority-${task.priority}">${task.priority}</span>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <div class="task-actions">
        <button class="edit-task" data-id="${task.id}"><i class="fas fa-pen"></i></button>
        <button class="delete-task" data-id="${task.id}"><i class="fas fa-trash"></i></button>
      </div>
    </li>
  `).join('') || '<li style="color:var(--text-muted);padding:1rem">No tasks found</li>';

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => toggleTask(cb.dataset.id));
  });
  list.querySelectorAll('.edit-task').forEach(btn => {
    btn.addEventListener('click', () => editTask(btn.dataset.id));
  });
  list.querySelectorAll('.delete-task').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getTaskStats() {
  const stored = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
  return {
    total: stored.length,
    completed: stored.filter(t => t.completed).length,
    active: stored.filter(t => !t.completed).length
  };
}
