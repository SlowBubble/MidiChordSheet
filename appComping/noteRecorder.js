// noteRecorder.js — records notes and beats for the current active session

import * as midiEvent from '../esModules/midi-data/midiEvent.js';

let notes = [];
let beats = [];
let pendingClear = false;
const listeners = [];

function notify() {
  listeners.forEach(fn => fn({ notes: [...notes], beats: [...beats] }));
}

export function recordNote(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn && evt.type !== midiEvent.midiEvtType.NoteOff) return;
  if (pendingClear) {
    notes = [];
    beats = [];
    pendingClear = false;
  }
  notes.push({ type: evt.type, noteNum: evt.noteNum, time: evt.time });
  notify();
}

export function recordBeat(beat, time) {
  beats.push({ beat, time });
  notify();
}

// Call on idle/reset — clears on the next incoming note, not immediately
export function markIdle() {
  pendingClear = true;
}

export function getNotes() { return [...notes]; }
export function getBeats() { return [...beats]; }

export function subscribe(fn) { listeners.push(fn); }
