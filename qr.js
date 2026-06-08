/**
 * QR Tools Module
 * QR code generator and camera scanner
 */

import { showToast, logActivity } from './utils.js';

let html5QrCode = null;
let qrCanvas = null;

/** Initialize QR tools */
export function initQR() {
  bindGenerator();
}

function bindGenerator() {
  document.getElementById('generateQR').addEventListener('click', generateQR);
  document.getElementById('downloadQR').addEventListener('click', downloadQR);
}

/** Generate QR code from text input */
async function generateQR() {
  const text = document.getElementById('qrText').value.trim();
  if (!text) {
    showToast('Please enter text or URL', 'error');
    return;
  }

  const output = document.getElementById('qrOutput');
  output.innerHTML = '';

  try {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, {
      width: 256,
      margin: 2,
      color: { dark: '#1e1e2e', light: '#ffffff' }
    });
    output.appendChild(canvas);
    qrCanvas = canvas;
    document.getElementById('downloadQR').hidden = false;
    logActivity('Generated QR code', 'qrcode');
    showToast('QR code generated', 'success');
  } catch (err) {
    showToast('Failed to generate QR code', 'error');
    console.error(err);
  }
}

function downloadQR() {
  if (!qrCanvas) return;
  const link = document.createElement('a');
  link.download = 'qrcode.png';
  link.href = qrCanvas.toDataURL('image/png');
  link.click();
  showToast('QR code downloaded', 'success');
}

/** Start QR scanner (lazy init when section is visible) */
export async function startScanner() {
  if (html5QrCode) return;

  try {
    html5QrCode = new Html5Qrcode('qrReader');
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      () => {} // ignore scan failures
    );
  } catch (err) {
    document.getElementById('scanResult').textContent = 'Camera access denied or unavailable';
    console.error(err);
  }
}

/** Stop QR scanner */
export async function stopScanner() {
  if (!html5QrCode) return;
  try {
    await html5QrCode.stop();
    html5QrCode = null;
  } catch (e) { /* ignore */ }
}

function onScanSuccess(decodedText) {
  document.getElementById('scanResult').textContent = `Scanned: ${decodedText}`;
  showToast('QR code scanned!', 'success');
  logActivity('Scanned QR code', 'qrcode');
}
