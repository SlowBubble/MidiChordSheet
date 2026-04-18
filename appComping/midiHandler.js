// midiHandler.js — physical MIDI input routing

import * as pubSub from '../esModules/pub-sub/pubSub.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';
import * as midiInput from '../esModules/fire/midiInput.js';
import { volume, onNoteEvent } from './beatStateMgr.js';

function isGamifyOn() {
  return document.getElementById('gamify-cb')?.checked ?? false;
}

const [midiInputEvtPub, midiInputEvtSub] = pubSub.make();
midiInputEvtSub(evt => { if (!isGamifyOn()) onNoteEvent(evt, false); });

export function setupMidiHandler() {
  midiInput.setup(
    (notes, timeMs, velocity) => {
      notes.forEach(noteNum =>
        midiInputEvtPub(new midiEvent.NoteOnEvt({ noteNum, velocity: velocity ?? volume, channelNum: 0, time: timeMs }))
      );
    },
    (notes, timeMs) => {
      notes.forEach(noteNum =>
        midiInputEvtPub(new midiEvent.NoteOffEvt({ noteNum, channelNum: 0, time: timeMs }))
      );
    },
    () => {},
  );
}
