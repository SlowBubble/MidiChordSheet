// keyboardHandler.js — keyboard shortcuts and keyboard MIDI event routing

import { reset, onNoteEvent, volume, startManualBeat, manualBpm, setManualBpm } from './beatStateMgr.js';
import { initMidi, whenMidiReady } from './sound.js';
import { getNotes, getBeats, saveRecording, setNoteLengthDenom, getMeasureDurMs, getMeasure1StartMs, getBeatsPerMeasure, getLowNoteThreshold, getNoteLengthDenom_, getNoteStartDenom, getLabel, getBeatSubdivision } from './noteRecorder.js';
import { startReplay, stopReplay, isReplaying } from './replay.js';
import * as beatStateMgr from './beatStateMgr.js';
import { getNoteLengthDenom } from './buttons.js';

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
  let lastBackslashTime = 0; // m4a: track consecutive backslash presses

  window.addEventListener('keydown', e => {
    // Always try to init MIDI on any keydown (idempotent after first call)
    initMidi(volume, () => {
      if (!keyboardSubscribed) {
        keyboardEvtSub(evt => onNoteEvent(evt, true));
        keyboardSubscribed = true;
      }
      beatStateMgr.updateMeasureStatus();
    });

    // m4a: Enter key — start beat at manual BPM
    if (e.code === 'Enter') {
      e.preventDefault();
      startManualBeat();
      return;
    }

    // m4a: Backslash key — increment BPM by 5 when pressed consecutively
    if (e.code === 'Backslash') {
      e.preventDefault();
      const now = Date.now();
      if (now - lastBackslashTime < 1000) { // within 1 second = consecutive
        setManualBpm(manualBpm + 5);
        const display = document.getElementById('manual-bpm-display');
        if (display) display.textContent = manualBpm;
      }
      lastBackslashTime = now;
      return;
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
