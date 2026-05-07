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
let _snapBias = 0.7;

// noteNum -> index in notes[] for the most recent unresolved NoteOn
const openNotes = new Map();

function notify(beatFired = false, idleFired = false) {
  listeners.forEach(fn => fn({ notes: [...notes], beats: [...beats], beatFired, idleFired }));
}

export function recordNote(evt) {
  if (disabled) {
    console.log('recordNote: disabled, ignoring');
    return;
  }
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
  notify(false, true);
}

// Cancel pending clear (used when explicitly restarting recording)
// Returns true if there was a pending clear that was cancelled
export function cancelPendingClear() {
  const was = pendingClear;
  pendingClear = false;
  return was;
}

// Adjust all note and beat timestamps by an offset
// Used when appending to shift the existing recording to align with new recording
export function adjustTimestamps(offsetMs) {
  notes = notes.map(n => ({ ...n, onTime: n.onTime + offsetMs, offTime: n.offTime ? n.offTime + offsetMs : null }));
  beats = beats.map(b => ({ ...b, time: b.time + offsetMs }));
  if (_measure1StartMs !== null) _measure1StartMs += offsetMs;
  notify();
}
// pickupStartTime: when the pickup started (Date.now() domain)
// measureStartToTrim: the start time of the measure to trim if pickup has notes
// Returns true if trimming was performed
export function trimLastMeasureIfPickupHasNotes(pickupStartTime, measureStartToTrim) {
  if (!measureStartToTrim) return false;
  
  // Check if any notes were recorded during the pickup (after pickupStartTime)
  const pickupNotes = notes.filter(n => n.onTime >= pickupStartTime);
  
  if (pickupNotes.length > 0) {
    // There are notes in the pickup, so trim the last measure
    beats = beats.filter(b => b.time < measureStartToTrim);
    notes = notes.filter(n => n.onTime < measureStartToTrim || n.onTime >= pickupStartTime);
    openNotes.clear();
    return true;
  }
  
  return false;
}

export function getNotes() { return [...notes]; }
export function getBeats() { return [...beats]; }

// Trim notes and beats that fall within the last measure
export function trimLastMeasure(silent = false) {
  if (!_measureDurMs || !_measure1StartMs || beats.length === 0) return;
  
  // Find the start of the last complete measure
  // Count measure boundaries (beat 1 transitions)
  const measureBoundaries = [_measure1StartMs];
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].beat === 1 && (i === 0 || beats[i - 1].beat !== 1)) {
      measureBoundaries.push(beats[i].time);
    }
  }
  
  // If we have at least 2 measures, trim everything from the start of the last measure
  if (measureBoundaries.length >= 2) {
    const lastMeasureStart = measureBoundaries[measureBoundaries.length - 1];
    
    // Remove beats from last measure
    beats = beats.filter(b => b.time < lastMeasureStart);
    
    // Remove notes that start in the last measure
    notes = notes.filter(n => n.onTime < lastMeasureStart);
    
    // Close any open notes
    openNotes.clear();
    
    if (!silent) notify();
  }
}

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
export function setSnapBias(v) { _snapBias = Math.min(1, Math.max(0, v)); }
export function getSnapBias() { return _snapBias; }

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
    snapBias: _snapBias,
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
export function enable() { disabled = false; }
export function isDisabled() { return disabled; }

/** Populate recorder state from saved data (triggers subscribers). */
export function loadInto(savedNotes, savedBeats, savedMeasureDurMs, savedBeatsPerMeasure, savedLowNoteThreshold, savedNoteLengthDenom, savedNoteStartDenom, savedMeasure1StartMs, savedLabel, savedBeatSubdivision, savedSnapBias) {
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
  if (savedSnapBias != null) _snapBias = savedSnapBias;
  notify();
}
