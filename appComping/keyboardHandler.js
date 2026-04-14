// keyboardHandler.js — keyboard shortcuts and keyboard MIDI event routing

import { reset, onNoteEvent, volume, measureDurMs } from './beatStateMgr.js';
import { initMidi } from './sound.js';
import { getNotes, getBeats } from './noteRecorder.js';
import { startReplay, stopReplay, isReplaying } from './replay.js';

export function setupKeyboardHandler(keyboardEvtSub) {
  window.addEventListener('keydown', e => {
    // Always try to init MIDI on any keydown (idempotent after first call)
    initMidi(volume, () => {
      keyboardEvtSub(evt => onNoteEvent(evt, true));
    });

    if (e.code === 'Space') {
      e.preventDefault();
      if (isReplaying()) {
        stopReplay();
        return;
      }
      // If idle (no active drum pattern) and there are recorded notes, replay
      if (measureDurMs === null) {
        const notes = getNotes();
        const beats = getBeats();
        if (notes.length || beats.length) {
          startReplay(notes, beats);
          return;
        }
      }
      reset();
      return;
    }
  });
}
