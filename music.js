/**
 * Music Player Module
 * MP3 upload, playlist, visualizer, shuffle/repeat, favorites
 */

import { dbGetAll, dbPut, dbDelete, generateId } from './db.js';
import { showToast, logActivity, formatTime } from './utils.js';
import { t } from './i18n.js';

let playlist = [];
let currentIndex = -1;
let isPlaying = false;
let shuffle = false;
let repeat = 'none'; // none, all, one
let audioContext = null;
let analyser = null;
let animationId = null;

const FAVORITES_KEY = 'suh_music_favorites';
const RECENT_KEY = 'suh_music_recent';
const audio = () => document.getElementById('audioPlayer');

/** Initialize music player */
export async function initMusic() {
  playlist = await dbGetAll('music');
  renderPlaylist();
  renderRecent();
  bindEvents();
  setupAudioContext();
}

function bindEvents() {
  document.getElementById('musicUpload').addEventListener('change', handleUpload);
  document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
  document.getElementById('prevBtn').addEventListener('click', playPrev);
  document.getElementById('nextBtn').addEventListener('click', playNext);
  document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
  document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);
  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    audio().volume = e.target.value / 100;
  });
  document.getElementById('progressBar').addEventListener('input', (e) => {
    const a = audio();
    if (a.duration) a.currentTime = (e.target.value / 100) * a.duration;
  });

  const a = audio();
  a.volume = 0.8;
  a.addEventListener('timeupdate', updateProgress);
  a.addEventListener('ended', onTrackEnded);
  a.addEventListener('loadedmetadata', () => {
    document.getElementById('totalTime').textContent = formatTime(a.duration);
  });
}

/** Setup Web Audio API for visualizer */
function setupAudioContext() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaElementSource(audio());
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch (e) {
    console.warn('Audio visualizer unavailable:', e);
  }
}

/** Handle MP3 file uploads */
async function handleUpload(e) {
  const files = Array.from(e.target.files);
  for (const file of files) {
    if (!file.type.includes('audio') && !file.name.endsWith('.mp3')) continue;

    const track = {
      id: generateId(),
      name: file.name.replace(/\.mp3$/i, ''),
      artist: 'Unknown Artist',
      blob: file,
      size: file.size,
      added: new Date().toISOString()
    };
    await dbPut('music', track);
    playlist.push(track);
  }
  renderPlaylist();
  logActivity(`Uploaded ${files.length} music file(s)`, 'music');
  showToast(`${files.length} track(s) added to playlist`, 'success');
  e.target.value = '';
}

function renderPlaylist() {
  const list = document.getElementById('playlist');
  const favorites = getFavorites();

  list.innerHTML = playlist.map((track, i) => `
    <li class="${i === currentIndex ? 'active' : ''}" data-index="${i}">
      <i class="fas fa-music"></i>
      <span>${track.name}</span>
      <button class="fav-btn ${favorites.includes(track.id) ? 'active' : ''}" data-id="${track.id}">
        <i class="fas fa-star"></i>
      </button>
      <button class="btn-icon btn-sm delete-track" data-id="${track.id}" style="width:28px;height:28px">
        <i class="fas fa-trash"></i>
      </button>
    </li>
  `).join('') || '<li style="color:var(--text-muted);padding:1rem">No tracks yet. Upload MP3 files to get started.</li>';

  list.querySelectorAll('li[data-index]').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.fav-btn') || e.target.closest('.delete-track')) return;
      playTrack(parseInt(li.dataset.index));
    });
  });

  list.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.id);
      btn.classList.toggle('active');
    });
  });

  list.querySelectorAll('.delete-track').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteTrack(btn.dataset.id);
    });
  });
}

async function deleteTrack(id) {
  await dbDelete('music', id);
  playlist = playlist.filter(t => t.id !== id);
  if (currentIndex >= playlist.length) currentIndex = playlist.length - 1;
  renderPlaylist();
  showToast('Track removed', 'info');
}

function getFavorites() {
  return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
}

function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

function renderRecent() {
  const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  const list = document.getElementById('recentPlayed');
  list.innerHTML = recent.slice(0, 5).map(name => `
    <li><i class="fas fa-clock"></i><span>${name}</span></li>
  `).join('') || '<li style="color:var(--text-muted)">No recent tracks</li>';
}

function addToRecent(name) {
  let recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  recent = [name, ...recent.filter(n => n !== name)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderRecent();
}

/** Play track by index */
async function playTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  const track = playlist[index];

  const url = URL.createObjectURL(track.blob);
  const a = audio();
  a.src = url;
  await a.play();
  isPlaying = true;

  document.getElementById('trackTitle').textContent = track.name;
  document.getElementById('trackArtist').textContent = track.artist;
  document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-pause"></i>';
  document.getElementById('albumArt').classList.add('playing');

  renderPlaylist();
  addToRecent(track.name);
  startVisualizer();

  if (audioContext?.state === 'suspended') audioContext.resume();
}

function togglePlay() {
  const a = audio();
  if (!a.src) {
    if (playlist.length) playTrack(0);
    return;
  }
  if (isPlaying) {
    a.pause();
    isPlaying = false;
    document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-play"></i>';
    document.getElementById('albumArt').classList.remove('playing');
    stopVisualizer();
  } else {
    a.play();
    isPlaying = true;
    document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-pause"></i>';
    document.getElementById('albumArt').classList.add('playing');
    startVisualizer();
  }
}

function playNext() {
  if (!playlist.length) return;
  let next;
  if (shuffle) {
    next = Math.floor(Math.random() * playlist.length);
  } else {
    next = (currentIndex + 1) % playlist.length;
  }
  playTrack(next);
}

function playPrev() {
  if (!playlist.length) return;
  const a = audio();
  if (a.currentTime > 3) {
    a.currentTime = 0;
    return;
  }
  const prev = (currentIndex - 1 + playlist.length) % playlist.length;
  playTrack(prev);
}

function onTrackEnded() {
  if (repeat === 'one') {
    audio().currentTime = 0;
    audio().play();
  } else if (repeat === 'all' || currentIndex < playlist.length - 1) {
    playNext();
  } else {
    isPlaying = false;
    document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-play"></i>';
    document.getElementById('albumArt').classList.remove('playing');
    stopVisualizer();
  }
}

function toggleShuffle() {
  shuffle = !shuffle;
  document.getElementById('shuffleBtn').classList.toggle('active', shuffle);
}

function toggleRepeat() {
  const modes = ['none', 'all', 'one'];
  const icons = ['fa-repeat', 'fa-repeat', 'fa-repeat'];
  const idx = (modes.indexOf(repeat) + 1) % modes.length;
  repeat = modes[idx];
  const btn = document.getElementById('repeatBtn');
  btn.classList.toggle('active', repeat !== 'none');
  btn.innerHTML = repeat === 'one'
    ? '<i class="fas fa-repeat"></i><span style="font-size:0.6rem;position:absolute">1</span>'
    : '<i class="fas fa-repeat"></i>';
}

function updateProgress() {
  const a = audio();
  if (!a.duration) return;
  const pct = (a.currentTime / a.duration) * 100;
  document.getElementById('progressBar').value = pct;
  document.getElementById('currentTime').textContent = formatTime(a.currentTime);
}

/** Audio visualizer using canvas */
function startVisualizer() {
  if (!analyser) return;
  const canvas = document.getElementById('audioVisualizer');
  const ctx = canvas.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#d946ef');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }
  draw();
}

function stopVisualizer() {
  if (animationId) cancelAnimationFrame(animationId);
}

export async function getMusicStats() {
  const tracks = playlist.length ? playlist : await dbGetAll('music');
  return { trackCount: tracks.length };
}
