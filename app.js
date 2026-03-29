// === Translations ===
const TRANSLATIONS = {
  cs: {
    sessionSettings: 'Nastavení',
    octave: 'Oktáva',
    note: 'Tón',
    preview: '▶ Ukázka',
    volume: 'Hlasitost',
    startSession: 'Spustit',
    openSettings: 'Otevřít nastavení',
    holdToPlay: 'Stiskni a drž pro přehrání zvuku',
    notes: { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'H' },
  },
  en: {
    sessionSettings: 'Session Settings',
    octave: 'Octave',
    note: 'Note',
    preview: '▶ Preview',
    volume: 'Volume',
    startSession: 'Start Session',
    openSettings: 'Open settings',
    holdToPlay: 'Press and hold to play sound',
    notes: { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' },
  },
};

const lang = localStorage.getItem('bapp_lang') || 'cs';

function t(key) {
  return (TRANSLATIONS[lang] || TRANSLATIONS.cs)[key] || key;
}

function noteName(note) {
  return ((TRANSLATIONS[lang] || TRANSLATIONS.cs).notes || {})[note] || note;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.querySelectorAll('.note-btn').forEach(btn => {
    btn.textContent = noteName(btn.dataset.note);
  });
}

// === Constants ===
const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [3, 4, 5];
const FREQ = {
  C: { 3: 130.81, 4: 261.63, 5: 523.25 },
  D: { 3: 146.83, 4: 293.66, 5: 587.33 },
  E: { 3: 164.81, 4: 329.63, 5: 659.25 },
  F: { 3: 174.61, 4: 349.23, 5: 698.46 },
  G: { 3: 196.00, 4: 392.00, 5: 783.99 },
  A: { 3: 220.00, 4: 440.00, 5: 880.00 },
  B: { 3: 246.94, 4: 493.88, 5: 987.77 },
};

// === Settings ===
let settings = { note: 'A', octave: 4, volume: 70 };

function loadSettings() {
  const note = localStorage.getItem('bapp_note');
  const octave = parseInt(localStorage.getItem('bapp_octave'), 10);
  const volume = parseInt(localStorage.getItem('bapp_volume'), 10);
  if (note && NOTES.includes(note)) settings.note = note;
  if (OCTAVES.includes(octave)) settings.octave = octave;
  if (!isNaN(volume) && volume >= 0 && volume <= 100) settings.volume = volume;
}

function saveSettings() {
  localStorage.setItem('bapp_note', settings.note);
  localStorage.setItem('bapp_octave', String(settings.octave));
  localStorage.setItem('bapp_volume', String(settings.volume));
}

function renderSettings() {
  document.querySelectorAll('.octave-btn').forEach(btn => {
    const isSelected = parseInt(btn.dataset.octave, 10) === settings.octave;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-pressed', String(isSelected));
  });
  document.querySelectorAll('.note-btn').forEach(btn => {
    const isSelected = btn.dataset.note === settings.note;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-pressed', String(isSelected));
  });
  document.getElementById('note-display').textContent =
    `${noteName(settings.note)}${settings.octave} — ${FREQ[settings.note][settings.octave]} Hz`;
  document.getElementById('volume-slider').value = settings.volume;
}

// === Audio Engine ===
let audioCtx = null;
let oscillator = null;
let gainNode = null;
let stopTimer = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function playTone() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  // Tear down any in-flight oscillator first
  _teardown();

  const freq = FREQ[settings.note][settings.octave];
  const vol = settings.volume / 100;

  gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
  gainNode.connect(ctx.destination);

  oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
  oscillator.connect(gainNode);
  oscillator.start();
}

function stopTone() {
  if (!gainNode || !oscillator) return;
  const ctx = getAudioContext();
  gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);

  const osc = oscillator;
  const gn = gainNode;
  oscillator = null;
  gainNode = null;

  stopTimer = setTimeout(() => {
    stopTimer = null;
    try { osc.stop(); }    catch (_) {}
    try { osc.disconnect(); } catch (_) {}
    try { gn.disconnect(); }  catch (_) {}
  }, 60);
}

function _teardown() {
  if (stopTimer !== null) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (!oscillator && !gainNode) return;
  const osc = oscillator;
  const gn = gainNode;
  oscillator = null;
  gainNode = null;
  try { osc.stop(); }    catch (_) {}
  try { osc.disconnect(); } catch (_) {}
  try { gn.disconnect(); }  catch (_) {}
}

// === Mode Switching ===
function enterSettings() {
  stopTone();
  if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
  document.body.classList.remove('play-mode');
  document.body.classList.add('settings-mode');
}

function enterPlay() {
  document.body.classList.remove('settings-mode');
  document.body.classList.add('play-mode');
}

// === Preview ===
let previewTimeout = null;

function previewTone() {
  if (previewTimeout) clearTimeout(previewTimeout);
  stopTone();
  playTone().then(() => {
    previewTimeout = setTimeout(() => {
      stopTone();
      previewTimeout = null;
    }, 1000);
  });
}

// === Init ===
function init() {
  loadSettings();
  applyTranslations();
  renderSettings();

  // Mode switching
  document.getElementById('gear-btn').addEventListener('click', enterSettings);
  document.getElementById('start-session-btn').addEventListener('click', enterPlay);

  // Octave selection
  document.querySelectorAll('.octave-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.octave = parseInt(btn.dataset.octave, 10);
      saveSettings();
      renderSettings();
    });
  });

  // Note selection
  document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (NOTES.includes(btn.dataset.note)) {
        settings.note = btn.dataset.note;
        saveSettings();
        renderSettings();
      }
    });
  });

  // Volume
  document.getElementById('volume-slider').addEventListener('input', e => {
    settings.volume = parseInt(e.target.value, 10);
    saveSettings();
  });

  // Preview
  document.getElementById('preview-btn').addEventListener('click', previewTone);

  // Orb interaction
  const orb = document.getElementById('orb');

  orb.addEventListener('pointerdown', e => {
    e.preventDefault();
    orb.setPointerCapture(e.pointerId);
    orb.classList.add('active');
    playTone();
  });

  const releaseOrb = () => {
    if (!orb.classList.contains('active')) return;
    orb.classList.remove('active');
    stopTone();
  };

  orb.addEventListener('pointerup', releaseOrb);
  orb.addEventListener('pointerleave', releaseOrb);
  orb.addEventListener('pointercancel', releaseOrb);
}

document.addEventListener('DOMContentLoaded', init);
