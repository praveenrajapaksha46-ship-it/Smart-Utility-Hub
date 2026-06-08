/**
 * Weather Dashboard Module
 * Uses Open-Meteo API (free, no API key) and OpenStreetMap Nominatim for geocoding
 */

import { showToast, logActivity, weatherIcon, weatherDesc } from './utils.js';

let lastCoords = null;

/** Initialize weather module */
export function initWeather() {
  bindEvents();
  // Auto-load weather on GPS or default city
  loadWeatherByGPS();
}

function bindEvents() {
  document.getElementById('weatherSearch').addEventListener('click', searchByCity);
  document.getElementById('weatherGPS').addEventListener('click', loadWeatherByGPS);
  document.getElementById('weatherCity').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchByCity();
  });
}

/** Search weather by city name using Nominatim */
async function searchByCity() {
  const city = document.getElementById('weatherCity').value.trim();
  if (!city) return;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (!data.length) {
      showToast('City not found', 'error');
      return;
    }
    await fetchWeather(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name);
    logActivity(`Weather searched: ${city}`, 'cloud-sun');
  } catch (err) {
    showToast('Failed to fetch weather data', 'error');
    console.error(err);
  }
}

/** Load weather using browser GPS */
function loadWeatherByGPS() {
  if (!navigator.geolocation) {
    fetchWeather(40.7128, -74.006, 'New York, US');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      lastCoords = { lat: latitude, lon: longitude };
      await fetchWeather(latitude, longitude, 'Your Location');
    },
    () => {
      fetchWeather(40.7128, -74.006, 'New York, US');
      showToast('Using default location (GPS denied)', 'info');
    }
  );
}

/** Fetch weather from Open-Meteo API */
async function fetchWeather(lat, lon, locationName) {
  const container = document.getElementById('weatherCurrent');
  container.innerHTML = '<div class="card-body loading">Loading weather...</div>';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
    const res = await fetch(url);
    const data = await res.json();

    renderCurrentWeather(data, locationName);
    renderForecast(data);
    lastCoords = { lat, lon };
  } catch (err) {
    container.innerHTML = '<div class="card-body loading">Failed to load weather data</div>';
    showToast('Weather API error', 'error');
  }
}

function renderCurrentWeather(data, location) {
  const c = data.current;
  const container = document.getElementById('weatherCurrent');

  container.innerHTML = `
    <div class="card-body">
      <div>
        <h2 style="margin-bottom:0.5rem">${location}</h2>
        <div class="weather-temp">${Math.round(c.temperature_2m)}°C</div>
        <div class="weather-desc"><i class="fas ${weatherIcon(c.weather_code)}"></i> ${weatherDesc(c.weather_code)}</div>
      </div>
      <div class="weather-details">
        <div class="weather-detail">
          <i class="fas fa-temperature-half"></i>
          <span>Temperature</span>
          <strong>${Math.round(c.temperature_2m)}°C</strong>
        </div>
        <div class="weather-detail">
          <i class="fas fa-droplet"></i>
          <span>Humidity</span>
          <strong>${c.relative_humidity_2m}%</strong>
        </div>
        <div class="weather-detail">
          <i class="fas fa-wind"></i>
          <span>Wind Speed</span>
          <strong>${Math.round(c.wind_speed_10m)} km/h</strong>
        </div>
      </div>
    </div>
  `;
}

function renderForecast(data) {
  const grid = document.getElementById('forecastGrid');
  const days = data.daily.time.map((date, i) => ({
    date,
    code: data.daily.weather_code[i],
    high: Math.round(data.daily.temperature_2m_max[i]),
    low: Math.round(data.daily.temperature_2m_min[i])
  }));

  grid.innerHTML = days.map(day => `
    <div class="forecast-card glass">
      <div class="day">${formatDay(day.date)}</div>
      <i class="fas ${weatherIcon(day.code)}"></i>
      <div class="temps">
        <span class="high">${day.high}°</span> / <span class="low">${day.low}°</span>
      </div>
    </div>
  `).join('');
}

function formatDay(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getWeatherCoords() {
  return lastCoords;
}
