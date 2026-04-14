// keyboardHandler.js — keyboard shortcuts and keyboard MIDI event routing

import { reset, onNoteEvent, volume } from './beatStateMgr.js';
import { initMidi } from './sound.js';

export function setupKeyboardHandler(keyboardEvtSub) {
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      reset();
    }
    initMidi(volume, () => {
      keyboardEvtSub(evt => onNoteEvent(evt, true));
    });
  });
}
