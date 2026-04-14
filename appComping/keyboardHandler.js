// keyboardHandler.js — keyboard shortcuts and keyboard MIDI event routing

import { reset, onNoteEvent, volume } from './beatStateMgr.js';
import { initMidi, whenMidiReady } from './sound.js';
import { getNotes, getBeats, saveRecording, setNoteLengthDenom } from './noteRecorder.js';
import { startReplay, stopReplay, isReplaying } from './replay.js';
import * as beatStateMgr from './beatStateMgr.js';
import { getNoteLengthDenom } from './buttons.js';

export function setupKeyboardHandler(keyboardEvtSub) {
  window.addEventListener('keydown', e => {
    // Always try to init MIDI on any keydown (idempotent after first call)
    initMidi(volume, () => {
      keyboardEvtSub(evt => onNoteEvent(evt, true));
      beatStateMgr.updateMeasureStatus();
    });

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
