// noteRecorder.js — records notes and beats for the current active session

import * as midiEvent from '../esModules/midi-data/midiEvent.js';

// notes entries: { noteNum, onTime, offTime }
// offTime is null until the NoteOff arrives.
let notes = [];
let beats = [];
let pendingClear = false;
const listeners = [];

// noteNum -> index in notes[] for the most recent unresolved NoteOn
const openNotes = new Map();

function notify() {
  listeners.forEach(fn => fn({ notes: [...notes], beats: [...beats] }));
}

export function recordNote(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn && evt.type !== midiEvent.midiEvtType.NoteOff) return;
  if (pendingClear) {
    notes = [];
    beats = [];
    openNotes.clear();
    pendingClear = false;
  }

  if (evt.type === midiEvent.midiEvtType.NoteOn) {
    const idx = notes.length;
    notes.push({ noteNum: evt.noteNum, velocity: evt.velocity, onTime: evt.time, offTime: null });
    openNotes.set(evt.noteNum, idx);
  } else {
    // NoteOff — resolve the matching open NoteOn
    const idx = openNotes.get(evt.noteNum);
    if (idx !== undefined) {
      notes[idx].offTime = evt.time;
      openNotes.delete(evt.noteNum);
    }
  }
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
