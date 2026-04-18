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
  notify(false, true);
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
export function setSnapBias(v) { _snapBias = Math.min(1, Math.max(0, v)); }
export function getSnapBias() { return _snapBias; }

export function subscribe(fn) { listeners.push(fn); }

// ── chord grouping (shared with sheetDisplay) ─────────────────────────────────

// Notes within this window are considered simultaneous across voices and get
// their onTime unified to the earliest in the group before voice splitting.
export const CROSS_VOICE_CHORD_MS = 35;

// Notes within this window are grouped as a simultaneous chord within a voice.
export const CHORD_THRESHOLD_MS = 60;

/**
 * Align notes played simultaneously across voices: any cluster of notes whose
 * onTimes all fall within CROSS_VOICE_CHORD_MS of the earliest gets snapped to
 * that earliest time.
 */
export function alignCrossVoiceChords(noteOns) {
  if (noteOns.length < 2) return noteOns;
  const sorted = [...noteOns].sort((a, b) => a.onTime - b.onTime);
  const result = sorted.map(n => ({ ...n }));
  let groupStart = 0;
  for (let i = 1; i <= result.length; i++) {
    const endOfGroup = i === result.length || result[i].onTime - result[groupStart].onTime > CROSS_VOICE_CHORD_MS;
    if (endOfGroup) {
      const anchor = result[groupStart].onTime;
      for (let j = groupStart; j < i; j++) result[j] = { ...result[j], onTime: anchor };
      groupStart = i;
    }
  }
  return result;
}

/**
 * Group NoteOn events within CHORD_THRESHOLD_MS of each other as simultaneous (chord).
 * Returns an array of arrays, each inner array being one chord group.
 */
export function groupSimultaneous(noteOns, thresholdMs = CHORD_THRESHOLD_MS) {
  if (!noteOns.length) return [];
  const sorted = [...noteOns].sort((a, b) => a.onTime - b.onTime);
  const groups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].onTime - current[0].onTime <= thresholdMs) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);
  return groups;
}

/**
 * Group recorded notes into sequential note groups for each hand, using the
 * same chord-alignment and simultaneous-grouping logic as the sheet renderer.
 * Returns { lhGroups, rhGroups } where each group is { noteNums, velocities, onTime }.
 * @param {number} threshold - noteNum <= threshold is left hand
 */
export function getNoteGroups(threshold) {
  const noteOns = notes.filter(n => n.onTime != null);
  const aligned = alignCrossVoiceChords(noteOns);

  const lhNoteOns = aligned.filter(n => n.noteNum <= threshold);
  const rhNoteOns = aligned.filter(n => n.noteNum > threshold);

  function toGroups(noteOnsForHand) {
    return groupSimultaneous(noteOnsForHand).map(chord => ({
      noteNums: chord.map(n => n.noteNum),
      velocities: chord.map(n => n.velocity ?? 80),
      onTime: chord[0].onTime,
    }));
  }

  const lhGroups = toGroups(lhNoteOns);
  const rhGroups = toGroups(rhNoteOns);
  return { lhGroups, rhGroups };
}

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
