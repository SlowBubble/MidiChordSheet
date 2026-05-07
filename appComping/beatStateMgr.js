// beatStateMgr.js — app state, drum loop, and all logic

import { genMidiPattern } from '../esModules/musical-beat/pattern.js';
import { drumNoteOn } from './sound.js';
import { recordBeat, markIdle, recordNote } from './noteRecorder.js';
import * as noteRecorder from './noteRecorder.js';

// ── settings ──────────────────────────────────────────────────────────────────

export const volume = 120;
export let beatsPerMeasure = 4;
export let beatSubdivision = 1;
export let lowNoteThreshold = 62;
export let idleMeasures = 1;
export const highNoteThreshold = 72;
export let manualBpm = 75; // m4a: default BPM for Enter key start

export function setBeatsPerMeasure(v) { beatsPerMeasure = v; noteRecorder.setBeatsPerMeasure(v); }
export function setBeatSubdivision(v) { beatSubdivision = v; noteRecorder.setBeatSubdivision(v); }
export function setLowNoteThreshold(v) { lowNoteThreshold = v; noteRecorder.setLowNoteThreshold(v); }
export function setIdleMeasures(v) { idleMeasures = v; }
export function setManualBpm(v) { manualBpm = v; }

// ── runtime state ─────────────────────────────────────────────────────────────

export let lastMidiEventTime = null;
export let measureDurMs = null;
export let drumMuted = false;
export let drumPatternStartTime = null;
export let drumCurrentBeat = 0;
let _isInReplayMode = false; // m4b: track replay mode to disable recording

export function setLastMidiEventTime(v) { lastMidiEventTime = v; }
export function setMeasureDurMs(v) { measureDurMs = v; noteRecorder.setMeasureDurMs(v); }
export function setReplayMode(v) { _isInReplayMode = v; } // m4b
export function isInReplayMode() { return _isInReplayMode; } // m4b

export const bassNoteOnTimes = new Map();
export const sopranoNoteOnTimes = new Map();
export const lowNoteList = [];

let pendingUnmuteTimer = null;
let pendingMuteTimer = null;
let idleClearTimer = null;
let drumRunning = false;
let drumRafId = null;

// ── helpers ───────────────────────────────────────────────────────────────────

export function midiToNoteName(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[midi % 12] + Math.floor(midi / 12 - 1);
}

export function updateMeasureStatus() {
  const el = document.getElementById('status');
  if (!el) return;
  if (measureDurMs !== null) {
    const bpm = Math.round((beatsPerMeasure / measureDurMs) * 60000);
    el.textContent = `🔴 ${bpm} BPM`;
    el.className = 'status';
  } else if (lowNoteList.length > 0) {
    const distinctAsc = [...new Set(lowNoteList.map(n => n.noteNum))].sort((a, b) => a - b);
    const triggerThreshold = distinctAsc.length >= 2 ? distinctAsc[1] : distinctAsc[0];
    el.textContent = `⭕ Next Measure Trigger: <= ${midiToNoteName(triggerThreshold)}`;
    el.className = 'status';
  } else {
    el.textContent = `1st Measure Trigger: <= ${midiToNoteName(lowNoteThreshold)}`;
    el.className = 'status status-green';
  }
}

export function resetIdleClearTimer() {
  if (idleClearTimer !== null) clearTimeout(idleClearTimer);
  idleClearTimer = setTimeout(() => {
    if (measureDurMs === null && !noteRecorder.isDisabled()) {
      // Drum beats never started — discard any notes the user played before going idle
      lowNoteList.length = 0;
      markIdle();
      updateMeasureStatus();
    }
    idleClearTimer = null;
  }, 2000);
}

// ── checkbox queries ──────────────────────────────────────────────────────────

export function isSilentTilDoubleBass() {
  return document.getElementById('silent-til-double-bass-cb')?.checked;
}

export function isMuteIfDoubleSoprano() {
  return document.getElementById('mute-if-double-soprano-cb')?.checked;
}

export function isDrumbeatDisabled() {
  return document.getElementById('disable-drumbeat-cb')?.checked;
}

export function isReplayDrumbeatDisabled() {
  return document.getElementById('no-replay-drumbeat-cb')?.checked;
}

// ── mute / unmute scheduling ──────────────────────────────────────────────────

export function scheduleUnmute(now) {
  if (pendingUnmuteTimer !== null) return;
  if (measureDurMs === null || drumPatternStartTime === null) {
    drumMuted = false;
    return;
  }
  const beatDurMs = measureDurMs / beatsPerMeasure;
  const finalBeat = beatsPerMeasure - 1;
  const elapsed = (now - drumPatternStartTime) % measureDurMs;
  const delayMs = drumCurrentBeat >= finalBeat
    ? measureDurMs - elapsed
    : (finalBeat * beatDurMs) - elapsed;

  pendingUnmuteTimer = setTimeout(() => {
    drumMuted = false;
    pendingUnmuteTimer = null;
  }, Math.max(0, delayMs));
}

export function scheduleMute(now) {
  if (pendingMuteTimer !== null) return;
  if (measureDurMs === null || drumPatternStartTime === null) {
    drumMuted = true;
    return;
  }
  const elapsed = (now - drumPatternStartTime) % measureDurMs;
  const delayMs = measureDurMs - elapsed;

  pendingMuteTimer = setTimeout(() => {
    drumMuted = true;
    pendingMuteTimer = null;
  }, Math.max(0, delayMs));
}

export function checkDoubleBassUnmute(noteNum, now) {
  if (!isSilentTilDoubleBass() || !drumMuted) return;
  if (noteNum > lowNoteThreshold) return;
  bassNoteOnTimes.set(noteNum, now);
  for (const partner of [noteNum - 12, noteNum + 12]) {
    const t = bassNoteOnTimes.get(partner);
    if (t !== undefined && Math.abs(now - t) <= 300) { scheduleUnmute(now); return; }
  }
}

export function checkDoubleSopranoMute(noteNum, now) {
  if (!isMuteIfDoubleSoprano() || drumMuted) return;
  if (noteNum < highNoteThreshold) return;
  sopranoNoteOnTimes.set(noteNum, now);
  for (const partner of [noteNum - 12, noteNum + 12]) {
    const t = sopranoNoteOnTimes.get(partner);
    if (t !== undefined && Math.abs(now - t) <= 300) { scheduleMute(now); return; }
  }
}

// ── drum pattern ──────────────────────────────────────────────────────────────

export function stopDrumPattern() {
  drumRunning = false;
  if (drumRafId !== null) { cancelAnimationFrame(drumRafId); drumRafId = null; }
}

export function isDrumRunning() { return drumRunning; }

export function playDrumPattern(durMs, measure1StartMs, startImmediately = false) {
  stopDrumPattern();
  drumMuted = isSilentTilDoubleBass();

  const timeSig = { upperNumeral: beatsPerMeasure, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, beatSubdivision);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = durMs / numDivisions;
  const divisionsPerBeat = numDivisions / beatsPerMeasure;

  drumRunning = true;
  let nextDivIdx = 0;

  // Anchor the drum grid to measure1StartMs (Date.now() domain).
  // Convert to performance.now() domain for the RAF loop.
  const nowPerf = performance.now();
  const nowDate = Date.now();
  const perfToDateOffset = nowDate - nowPerf; // date = perf + offset

  // measure1StartMs is in Date.now() domain; convert to perf domain
  const measure1StartPerf = measure1StartMs - perfToDateOffset;

  // Determine when the pattern should start firing
  let patternStartPerf;
  if (startImmediately) {
    // Start immediately (now), treating this as the pickup measure
    // The pattern will fire starting from now, but beats are timestamped relative to measure1StartMs
    patternStartPerf = nowPerf;
  } else {
    // Normal mode: start at measure 2 (one measure after measure1StartMs)
    patternStartPerf = measure1StartPerf + durMs;
  }
  
  nextDivIdx = 0;
  let nextFireTime = patternStartPerf;

  // If patternStartPerf is in the past (shouldn't happen normally), start from now
  if (nextFireTime < nowPerf) {
    nextFireTime = nowPerf;
  }

  drumPatternStartTime = patternStartPerf;

  function tick(now) {
    if (!drumRunning) return;

    // During pickup append mode, continuously update lastMidiEventTime to prevent idle timeout
    if (isInPickupAppendMode) {
      lastMidiEventTime = now;
    }
    
    // During pickup append mode, give extra time before idle timeout
    const idleTimeoutMs = isInPickupAppendMode ? (idleMeasures + 1) * durMs : idleMeasures * durMs;
    
    if (lastMidiEventTime !== null && (now - lastMidiEventTime) > idleTimeoutMs) {
      console.log('m1i: idle timeout, stopping drums');
      stopDrumPattern();
      measureDurMs = null;
      lowNoteList.length = 0;
      markIdle();
      updateMeasureStatus();
      document.getElementById('beat-display').textContent = '';
      isInPickupAppendMode = false;
      pickupAppendStartTime = null;
      pickupAppendMeasureStart = null;
      pickupAppendFirstBeat1Seen = false;
      return;
    }

    while (nextFireTime <= now) {
      const divInMeasure = nextDivIdx % numDivisions;
      const beat = Math.floor(divInMeasure / divisionsPerBeat) + 1;
      drumCurrentBeat = beat - 1;
      document.getElementById('beat-display').textContent = '⚪'.repeat(beat);
      pattern.evtsArrs[divInMeasure].forEach(note =>
        drumNoteOn(note.noteNum, drumMuted ? 0 : note.velocity)
      );
      const beatDateMs = now + perfToDateOffset;
      recordBeat(beat, beatDateMs);
      
      // Check if we just hit beat 1 while in pickup append mode
      // Only check on the first subdivision of beat 1 (divInMeasure === 0)
      if (isInPickupAppendMode && beat === 1 && divInMeasure === 0) {
        if (!pickupAppendFirstBeat1Seen) {
          // This is the first beat 1 after starting the pickup - mark it
          pickupAppendFirstBeat1Seen = true;
        } else {
          // This is the SECOND beat 1 - we've completed one full measure after the pickup
          // Now check if there were notes in the pickup and trim if so
          noteRecorder.trimLastMeasureIfPickupHasNotes(pickupAppendStartTime, pickupAppendMeasureStart);
          isInPickupAppendMode = false;
          pickupAppendStartTime = null;
          pickupAppendMeasureStart = null;
          pickupAppendFirstBeat1Seen = false;
        }
      }
      
      nextDivIdx++;
      nextFireTime += divisionMs;
    }

    drumRafId = requestAnimationFrame(tick);
  }

  drumRafId = requestAnimationFrame(tick);
}

// ── replay drum scheduling ────────────────────────────────────────────────────

// Schedules drum hits for a replay session using setTimeout (no RAF loop).
// Returns an array of timeout IDs so the caller can cancel them.
// measure1StartMs: Date.now() time of beat 1 of measure 1.
// durationMs: one measure duration.
// numMeasures: how many measures to schedule.
// originTime: Date.now() replay origin (subtracted to get delay ms).
export function scheduleReplayDrums(measure1StartMs, durationMs, numMeasures, originTime, beatsPerMeasureVal, beatSubdivisionVal) {
  const timeSig = { upperNumeral: beatsPerMeasureVal, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, beatSubdivisionVal);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = durationMs / numDivisions;
  const divisionsPerBeat = numDivisions / beatsPerMeasureVal;
  const beatDisplay = document.getElementById('beat-display');
  const ids = [];

  // Start from measure 1 (measure1StartMs), schedule all divisions across numMeasures
  const totalDivisions = numDivisions * numMeasures;
  for (let d = 0; d < totalDivisions; d++) {
    const fireTime = measure1StartMs + d * divisionMs;
    const delay = fireTime - originTime;
    if (delay < 0) continue;
    const divInMeasure = d % numDivisions;
    const beat = Math.floor(divInMeasure / divisionsPerBeat) + 1;
    const notes = pattern.evtsArrs[divInMeasure];
    ids.push(setTimeout(() => {
      if (beatDisplay) beatDisplay.textContent = '⚪'.repeat(beat);
      notes.forEach(note => drumNoteOn(note.noteNum, note.velocity));
    }, delay));
  }
  return ids;
}

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';

function handleMeasureTiming(evt) {
  if (isDrumbeatDisabled()) return;
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum > lowNoteThreshold) return;

  // m4b: Don't trigger beat/recording during replay
  if (_isInReplayMode) return;

  if (measureDurMs === null) {
    const distinctAsc = [...new Set(lowNoteList.map(n => n.noteNum))].sort((a, b) => a - b);
    const triggerThreshold = distinctAsc.length >= 2 ? distinctAsc[1] : distinctAsc[0];
    if (distinctAsc.length > 0 && evt.noteNum < triggerThreshold) {
      const dur = evt.time - lowNoteList[0].time;
      const measure1StartMs = lowNoteList[0].time;
      measureDurMs = dur;
      if (!noteRecorder.isDisabled()) {
        noteRecorder.setMeasureDurMs(dur);
        noteRecorder.setMeasure1StartMs(measure1StartMs);
      }
      updateMeasureStatus();
      playDrumPattern(dur, measure1StartMs, false);
      lowNoteList.length = 0;
    }
  }

  lowNoteList.push({ noteNum: evt.noteNum, time: evt.time });
  updateMeasureStatus();
}

// Called for every incoming MIDI event.
// withSound=true for keyboard input, false for physical MIDI input (timing only).
export function onNoteEvent(evt, withSound) {
  // m4b: Don't record or trigger during replay
  if (_isInReplayMode) {
    // Still play the sound for keyboard input during replay
    if (withSound) {
      if (evt.type === midiEvent.midiEvtType.NoteOn) {
        pianoNoteOn(evt.noteNum, evt.velocity);
      } else if (evt.type === midiEvent.midiEvtType.NoteOff) {
        pianoNoteOff(evt.noteNum);
      }
    }
    return;
  }

  lastMidiEventTime = performance.now();
  resetIdleClearTimer();
  if (evt.type === midiEvent.midiEvtType.NoteOn) {
    if (withSound) pianoNoteOn(evt.noteNum, evt.velocity);
    checkDoubleBassUnmute(evt.noteNum, performance.now());
    checkDoubleSopranoMute(evt.noteNum, performance.now());
  } else if (evt.type === midiEvent.midiEvtType.NoteOff) {
    if (withSound) pianoNoteOff(evt.noteNum);
  }
  if (!isDrumbeatDisabled()) recordNote(evt);
  handleMeasureTiming(evt);
}

// ── manual start (m4a) ────────────────────────────────────────────────────────

let isInPickupAppendMode = false; // Track if we're in pickup append mode
let pickupAppendStartTime = null; // When the pickup append started
let pickupAppendMeasureStart = null; // Where the measure to potentially trim starts
let pickupAppendFirstBeat1Seen = false; // Track if we've seen the first beat 1 after pickup starts

// Start beat at the configured manualBpm without waiting for measure timing
export function startManualBeat() {
  // m4b: Don't allow manual start during replay
  if (_isInReplayMode) return;

  const now = Date.now();
  
  // Enable recording (in case it was disabled for viewing a saved recording)
  noteRecorder.enable();
  
  // Cancel any pending clear FIRST, before checking for existing recording
  // This prevents the recording from being cleared between idle and restart
  noteRecorder.cancelPendingClear();
  
  // Check if there's an existing recording (even if drums stopped)
  const notes = noteRecorder.getNotes();
  const beats = noteRecorder.getBeats();
  const hasExistingRecording = notes.length > 0 || beats.length > 0;
  const storedMeasureDurMs = noteRecorder.getMeasureDurMs();
  const storedMeasure1StartMs = noteRecorder.getMeasure1StartMs();
  
  // If already running OR there's an existing recording, continue recording (append mode)
  if (measureDurMs !== null || drumRunning || (hasExistingRecording && storedMeasureDurMs !== null && storedMeasure1StartMs !== null)) {
    stopDrumPattern();
    
    // Use stored duration if measureDurMs was reset
    const dur = measureDurMs || storedMeasureDurMs || (beatsPerMeasure / manualBpm) * 60000;
    
    // Find the last beat time to determine where the recording ends
    const beats = noteRecorder.getBeats();
    let lastBeatTime = storedMeasure1StartMs;
    if (beats.length > 0) {
      lastBeatTime = beats[beats.length - 1].time;
    }
    
    // Calculate how many measures exist in the old recording
    const elapsedMs = lastBeatTime - storedMeasure1StartMs;
    const measuresInRecording = Math.ceil(elapsedMs / dur);
    
    // Position the new recording so the pickup measure OVERLAPS the last measure of the old recording
    // This way:
    // - If there are notes in the pickup, we trim the last measure (handled later)
    // - If there are NO notes in the pickup, the recordings connect seamlessly
    // New measure 1 starts at: now + dur
    // We want the old recording's last measure to align with the pickup
    const newMeasure1StartMs = now + dur - (measuresInRecording - 1) * dur;
    
    // Calculate the time offset needed to shift the old recording
    const timeOffset = newMeasure1StartMs - storedMeasure1StartMs;
    
    // Adjust all existing timestamps to align with the new recording
    noteRecorder.adjustTimestamps(timeOffset);
    
    // Now mark that we're in pickup append mode
    isInPickupAppendMode = true;
    pickupAppendStartTime = now;
    pickupAppendFirstBeat1Seen = false;
    
    // Calculate where the last measure starts (the one we might trim) - AFTER adjustment
    const adjustedBeats = noteRecorder.getBeats();
    let pickupAppendMeasureStart = null;
    if (adjustedBeats.length > 0) {
      // Find the start of the last measure
      const measureBoundaries = [newMeasure1StartMs];
      for (let i = 0; i < adjustedBeats.length; i++) {
        if (adjustedBeats[i].beat === 1 && (i === 0 || adjustedBeats[i - 1].beat !== 1)) {
          measureBoundaries.push(adjustedBeats[i].time);
        }
      }
      if (measureBoundaries.length >= 2) {
        pickupAppendMeasureStart = measureBoundaries[measureBoundaries.length - 1];
      }
    }
    
    // Restore measureDurMs if it was reset
    measureDurMs = dur;
    
    // Reset lastMidiEventTime so idle timeout doesn't trigger immediately
    lastMidiEventTime = performance.now();
    
    if (!noteRecorder.isDisabled()) {
      noteRecorder.setMeasureDurMs(dur);
      // measure1StartMs was already updated by adjustTimestamps
    }
    
    updateMeasureStatus();
    
    // Start drum pattern immediately as a pickup measure
    playDrumPattern(dur, newMeasure1StartMs, true);
    lowNoteList.length = 0;
    return;
  }
  
  // First time: start fresh
  const dur = (beatsPerMeasure / manualBpm) * 60000;
  
  // Treat the initial beats as pickup: measure1StartMs is one measure in the future
  const measure1StartMs = now + dur;
  
  measureDurMs = dur;
  lastMidiEventTime = performance.now();
  
  // Also use pickup append mode for fresh recordings to prevent early idle timeout
  isInPickupAppendMode = true;
  pickupAppendStartTime = now;
  pickupAppendMeasureStart = null; // No last measure to trim for fresh recording
  pickupAppendFirstBeat1Seen = false;
  
  if (!noteRecorder.isDisabled()) {
    noteRecorder.setMeasureDurMs(dur);
    noteRecorder.setMeasure1StartMs(measure1StartMs);
  }
  updateMeasureStatus();
  
  // Start drum pattern immediately (at what will be the pickup measure)
  playDrumPattern(dur, measure1StartMs, true);
  lowNoteList.length = 0;
}

// ── reset ─────────────────────────────────────────────────────────────────────

export function reset() {
  stopDrumPattern();
  if (pendingUnmuteTimer !== null) { clearTimeout(pendingUnmuteTimer); pendingUnmuteTimer = null; }
  if (pendingMuteTimer !== null) { clearTimeout(pendingMuteTimer); pendingMuteTimer = null; }
  if (idleClearTimer !== null) { clearTimeout(idleClearTimer); idleClearTimer = null; }
  measureDurMs = null;
  lowNoteList.length = 0;
  bassNoteOnTimes.clear();
  sopranoNoteOnTimes.clear();
  drumPatternStartTime = null;
  drumCurrentBeat = 0;
  drumMuted = false;
  markIdle();
  updateMeasureStatus();
  document.getElementById('beat-display').textContent = '';
}
