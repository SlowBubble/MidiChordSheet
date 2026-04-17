// noteRecorder.js — records notes and beats for the current active session

import * as midiEvent from '../esModules/midi-data/midiEvent.js';

// notes entries: { noteNum, onTime, offTime }
// offTime is null until the NoteOff arrives.
let notes = [];
let beats = [];
let pendingClear = false;
const listeners = [];
let _measureDurMs = null;
let _measure1StartMs = null;
let _beatsPerMeasure = 4;
let _lowNoteThreshold = 62;
let _noteLengthDenom = 4;
let _noteStartDenom = 16;
let _beatSubdivision = 1;
let _label = null;

// noteNum -> index in notes[] for the most recent unresolved NoteOn
const openNotes = new Map();

function notify(beatFired = false) {
  listeners.forEach(fn => fn({ notes: [...notes], beats: [...beats], beatFired }));
}

export function recordNote(evt) {
  if (disabled) return;
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
  if (disabled) return;
  beats.push({ beat, time });
  notify(true);
}

// Call on idle/reset — clears on the next incoming note, not immediately
export function markIdle() {
  pendingClear = true;
}

export function getNotes() { return [...notes]; }
export function getBeats() { return [...beats]; }

// Store the last known non-null measureDurMs so it survives idle reset
export function setMeasureDurMs(v) { if (v != null) _measureDurMs = v; }
export function getMeasureDurMs() { return _measureDurMs; }
export function setMeasure1StartMs(v) { if (v != null) _measure1StartMs = v; }
export function getMeasure1StartMs() { return _measure1StartMs; }
export function setBeatsPerMeasure(v) { _beatsPerMeasure = v; }
export function getBeatsPerMeasure() { return _beatsPerMeasure; }
export function setLowNoteThreshold(v) { _lowNoteThreshold = v; }
export function getLowNoteThreshold() { return _lowNoteThreshold; }
export function setNoteLengthDenom(v) { _noteLengthDenom = v; }
export function getNoteLengthDenom_() { return _noteLengthDenom; }
export function setNoteStartDenom(v) { _noteStartDenom = v; }
export function getNoteStartDenom() { return _noteStartDenom; }
export function setLabel(v) { _label = v; }
export function getLabel() { return _label; }
export function setBeatSubdivision(v) { _beatSubdivision = v; }
export function getBeatSubdivision() { return _beatSubdivision; }

export function subscribe(fn) { listeners.push(fn); }

// ── localStorage persistence ──────────────────────────────────────────────────

const LS_INDEX_KEY = 'compingRecordings';

function getIndex() {
  try { return JSON.parse(localStorage.getItem(LS_INDEX_KEY)) || []; }
  catch { return []; }
}

/** Save current notes+beats to localStorage. Returns the new RecordingId. */
export function saveRecording(label) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const entry = {
    id,
    label: label || new Date().toLocaleString(),
    savedAt: Date.now(),
    notes: [...notes],
    beats: [...beats],
    measureDurMs: _measureDurMs,
    measure1StartMs: _measure1StartMs,
    beatsPerMeasure: _beatsPerMeasure,
    lowNoteThreshold: _lowNoteThreshold,
    noteLengthDenom: _noteLengthDenom,
    noteStartDenom: _noteStartDenom,
    beatSubdivision: _beatSubdivision,
  };
  localStorage.setItem('compingRec_' + id, JSON.stringify(entry));
  const idx = getIndex();
  idx.push({ id, label: entry.label, savedAt: entry.savedAt });
  localStorage.setItem(LS_INDEX_KEY, JSON.stringify(idx));
  return id;
}
/** Load a recording by id. Returns { notes, beats, label } or null. */
export function loadRecording(id) {
  try { return JSON.parse(localStorage.getItem('compingRec_' + id)) || null; }
  catch { return null; }
}

export function listRecordings() { return getIndex(); }

/** Disable live recording (used when viewing a saved recording). */
let disabled = false;
export function disable() { disabled = true; }

/** Populate recorder state from saved data (triggers subscribers). */
export function loadInto(savedNotes, savedBeats, savedMeasureDurMs, savedBeatsPerMeasure, savedLowNoteThreshold, savedNoteLengthDenom, savedNoteStartDenom, savedMeasure1StartMs, savedLabel, savedBeatSubdivision) {
  notes = savedNotes.map(n => ({ ...n }));
  beats = savedBeats.map(b => ({ ...b }));
  openNotes.clear();
  if (savedMeasureDurMs != null) _measureDurMs = savedMeasureDurMs;
  // Fallback for recordings saved before measure1StartMs was introduced
  const m1 = savedMeasure1StartMs ?? (beats.length && savedMeasureDurMs ? beats[0].time - savedMeasureDurMs : null);
  if (m1 != null) _measure1StartMs = m1;
  if (savedBeatsPerMeasure != null) _beatsPerMeasure = savedBeatsPerMeasure;
  if (savedLowNoteThreshold != null) _lowNoteThreshold = savedLowNoteThreshold;
  if (savedNoteLengthDenom != null) _noteLengthDenom = savedNoteLengthDenom;
  if (savedNoteStartDenom != null) _noteStartDenom = savedNoteStartDenom;
  if (savedLabel != null) _label = savedLabel;
  if (savedBeatSubdivision != null) _beatSubdivision = savedBeatSubdivision;
  notify();
}
