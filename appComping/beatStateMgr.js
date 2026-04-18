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

export function setBeatsPerMeasure(v) { beatsPerMeasure = v; noteRecorder.setBeatsPerMeasure(v); }
export function setBeatSubdivision(v) { beatSubdivision = v; noteRecorder.setBeatSubdivision(v); }
export function setLowNoteThreshold(v) { lowNoteThreshold = v; noteRecorder.setLowNoteThreshold(v); }
export function setIdleMeasures(v) { idleMeasures = v; }

// ── runtime state ─────────────────────────────────────────────────────────────

export let lastMidiEventTime = null;
export let measureDurMs = null;
export let drumMuted = false;
export let drumPatternStartTime = null;
export let drumCurrentBeat = 0;

export function setLastMidiEventTime(v) { lastMidiEventTime = v; }
export function setMeasureDurMs(v) { measureDurMs = v; noteRecorder.setMeasureDurMs(v); }

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

export function playDrumPattern(durMs, measure1StartMs) {
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

  // The first beat of measure 2 fires at measure1StartMs + durMs
  // Skip any divisions that are already in the past
  const measure2StartPerf = measure1StartPerf + durMs;
  nextDivIdx = 0;
  let nextFireTime = measure2StartPerf;

  // If measure2StartPerf is in the past (shouldn't happen normally), start from now
  if (nextFireTime < nowPerf) {
    nextFireTime = nowPerf;
  }

  drumPatternStartTime = measure2StartPerf;

  function tick(now) {
    if (!drumRunning) return;

    if (lastMidiEventTime !== null && (now - lastMidiEventTime) > idleMeasures * durMs) {
      console.log('m1i: idle timeout, stopping drums');      stopDrumPattern();
      measureDurMs = null;
      lowNoteList.length = 0;
      markIdle();
      updateMeasureStatus();
      document.getElementById('beat-display').textContent = '';
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
      const beatDateMs = nextFireTime + perfToDateOffset;
      recordBeat(beat, beatDateMs);
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
      playDrumPattern(dur, measure1StartMs);
      lowNoteList.length = 0;
    }
  }

  lowNoteList.push({ noteNum: evt.noteNum, time: evt.time });
  updateMeasureStatus();
}

// Called for every incoming MIDI event.
// withSound=true for keyboard input, false for physical MIDI input (timing only).
export function onNoteEvent(evt, withSound) {
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
