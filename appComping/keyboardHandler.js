// keyboardHandler.js — keyboard shortcuts and keyboard MIDI event routing

import { reset, onNoteEvent, volume } from './beatStateMgr.js';
import { initMidi, whenMidiReady, pianoNoteOn, pianoNoteOff } from './sound.js';
import { getNotes, getBeats, saveRecording, setNoteLengthDenom, getMeasureDurMs, getMeasure1StartMs, getBeatsPerMeasure, getLowNoteThreshold, getNoteLengthDenom_, getNoteStartDenom, getLabel, getBeatSubdivision, getNoteGroups } from './noteRecorder.js';
import { startReplay, startGamifyReplay, stopReplay, isReplaying } from './replay.js';
import * as beatStateMgr from './beatStateMgr.js';
import { getNoteLengthDenom } from './buttons.js';

// ── gamify key sets (mirrors appPlay/gameMgr.js) ──────────────────────────────
const LEFT_HAND_KEYS  = new Set(['a','s','d','f','1','2','3','4','5','q','w','e','r','t','z','x','c','v','g','b']);
const RIGHT_HAND_KEYS = new Set(['j','k','l',';','7','8','9','0','-','=','u','i','o','p','[',']',"'",'n','m',',','.','/',  '6','y','h']);

function isGamifyOn() {
  return document.getElementById('gamify-cb')?.checked ?? false;
}

// ── gamify state ──────────────────────────────────────────────────────────────
// Rebuilt each time a gamify key is first pressed (lazy, so it picks up the
// latest recording).  Indices loop so the user can keep playing indefinitely.
let _gamifyLhGroups = null;
let _gamifyRhGroups = null;
let _gamifyLhIdx = 0;
let _gamifyRhIdx = 0;
// key → { noteNums, velocities } for active (held) gamify notes
const _gamifyActiveKeys = new Map();

function ensureGamifyGroups() {
  if (_gamifyLhGroups === null) {
    const threshold = getLowNoteThreshold();
    const { lhGroups, rhGroups } = getNoteGroups(threshold);
    _gamifyLhGroups = lhGroups;
    _gamifyRhGroups = rhGroups;
    _gamifyLhIdx = 0;
    _gamifyRhIdx = 0;
  }
}

/** Reset gamify state so next key press re-reads the latest recording. */
function resetGamify() {
  _gamifyLhGroups = null;
  _gamifyRhGroups = null;
  _gamifyLhIdx = 0;
  _gamifyRhIdx = 0;
  _gamifyActiveKeys.clear();
}

function gamifyKeyDown(key) {
  if (_gamifyActiveKeys.has(key)) return; // already held
  ensureGamifyGroups();

  let groups, idx, setIdx;
  if (LEFT_HAND_KEYS.has(key)) {
    groups = _gamifyLhGroups;
    idx = _gamifyLhIdx;
    setIdx = v => { _gamifyLhIdx = v; };
  } else {
    groups = _gamifyRhGroups;
    idx = _gamifyRhIdx;
    setIdx = v => { _gamifyRhIdx = v; };
  }

  if (!groups || !groups.length) return;
  const gp = groups[idx % groups.length];
  _gamifyActiveKeys.set(key, gp);
  gp.noteNums.forEach((n, i) => pianoNoteOn(n, gp.velocities[i] ?? volume));
  setIdx((idx + 1) % groups.length);
}

function gamifyKeyUp(key) {
  const gp = _gamifyActiveKeys.get(key);
  if (!gp) return;
  gp.noteNums.forEach(n => pianoNoteOff(n));
  _gamifyActiveKeys.delete(key);
}

/** Encode a recording object to a URL-safe base64 string. */
function encodeRecording(rec) {
  const json = JSON.stringify(rec);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function setupKeyboardHandler(keyboardEvtSub) {
  let keyboardSubscribed = false;

  // keyup: release gamify notes when key is lifted
  window.addEventListener('keyup', e => {
    if (isGamifyOn() && (LEFT_HAND_KEYS.has(e.key) || RIGHT_HAND_KEYS.has(e.key))) {
      gamifyKeyUp(e.key);
    }
  });

  // Reset gamify groups whenever the checkbox is unchecked (so next enable
  // picks up the freshest recording).
  const _gamifyCb = document.getElementById('gamify-cb');
  if (_gamifyCb) _gamifyCb.addEventListener('change', () => { if (!_gamifyCb.checked) resetGamify(); });

  window.addEventListener('keydown', e => {
    // Always try to init MIDI on any keydown (idempotent after first call)
    initMidi(volume, () => {
      if (!keyboardSubscribed) {
        keyboardEvtSub(evt => {
          if (!isGamifyOn()) onNoteEvent(evt, true);
        });
        keyboardSubscribed = true;
      }
      beatStateMgr.updateMeasureStatus();
    });

    // ── gamify mode intercepts ────────────────────────────────────────────────
    if (isGamifyOn() && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Space in gamify mode: start/stop drums only (no recorded notes)
      if (e.code === 'Space') {
        e.preventDefault();
        if (isReplaying()) { stopReplay(); return; }
        if (beatStateMgr.measureDurMs === null) {
          // No active drum pattern — start drums-only replay
          const notes = getNotes();
          const beats = getBeats();
          if (notes.length || beats.length) {
            whenMidiReady(() => startGamifyReplay(beats));
            return;
          }
        }
        reset();
        resetGamify();
        return;
      }

      // LH / RH gamify keys
      if (LEFT_HAND_KEYS.has(e.key) || RIGHT_HAND_KEYS.has(e.key)) {
        e.preventDefault();
        gamifyKeyDown(e.key);
        return;
      }
    }

    // cmd+s (Mac) / ctrl+s (Win) — save recording
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      const notes = getNotes();
      const beats = getBeats();
      if (!notes.length && !beats.length) return;
      // Sync noteLengthDenom into noteRecorder before saving
      setNoteLengthDenom(getNoteLengthDenom());
      const label = prompt('Save recording as:', new Date().toLocaleString());
      if (label === null) return; // cancelled
      saveRecording(label || new Date().toLocaleString());
      const status = document.getElementById('status');
      if (status) {
        const prev = status.textContent;
        status.textContent = '💾 Saved!';
        setTimeout(() => { status.textContent = prev; }, 1500);
      }
      return;
    }

    // cmd+c (Mac) / ctrl+c (Win) — copy shareable link
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      const notes = getNotes();
      const beats = getBeats();
      if (!notes.length && !beats.length) return;
      e.preventDefault();
      setNoteLengthDenom(getNoteLengthDenom());
      const rec = {
        notes,
        beats,
        measureDurMs: getMeasureDurMs(),
        measure1StartMs: getMeasure1StartMs(),
        beatsPerMeasure: getBeatsPerMeasure(),
        lowNoteThreshold: getLowNoteThreshold(),
        noteLengthDenom: getNoteLengthDenom_(),
        noteStartDenom: getNoteStartDenom(),
        beatSubdivision: getBeatSubdivision(),
        label: getLabel(),
      };
      const encoded = encodeRecording(rec);
      const url = `${location.origin}${location.pathname}#data=${encoded}`;
      navigator.clipboard.writeText(url).then(() => {
        const status = document.getElementById('status');
        if (status) {
          const prev = status.textContent;
          status.textContent = '🔗 Link copied!';
          setTimeout(() => { status.textContent = prev; }, 1500);
        }
      });
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      const cb = document.getElementById('disable-drumbeat-cb');
      if (cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (isReplaying()) {
        stopReplay();
        return;
      }
      // If idle (no active drum pattern) and there are recorded notes, replay
      if (beatStateMgr.measureDurMs === null) {
        const notes = getNotes();
        const beats = getBeats();
        if (notes.length || beats.length) {
          whenMidiReady(() => startReplay(notes, beats));
          return;
        }
      }
      reset();
      return;
    }
  });
}
