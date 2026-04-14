// beatStateMgr.js — app state, drum loop, and all logic

import { genMidiPattern } from '../esModules/musical-beat/pattern.js';
import { drumNoteOn } from './sound.js';

// ── settings ──────────────────────────────────────────────────────────────────

export const volume = 120;
export let beatsPerMeasure = 4;
export let beatSubdivision = 1;
export let lowNoteThreshold = 62;
export let idleMeasures = 1;
export const highNoteThreshold = 72;

export function setBeatsPerMeasure(v) { beatsPerMeasure = v; }
export function setBeatSubdivision(v) { beatSubdivision = v; }
export function setLowNoteThreshold(v) { lowNoteThreshold = v; }
export function setIdleMeasures(v) { idleMeasures = v; }

// ── runtime state ─────────────────────────────────────────────────────────────

export let lastMidiEventTime = null;
export let measureDurMs = null;
export let drumMuted = false;
export let drumPatternStartTime = null;
export let drumCurrentBeat = 0;

export function setLastMidiEventTime(v) { lastMidiEventTime = v; }
export function setMeasureDurMs(v) { measureDurMs = v; }

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
    el.textContent = `🟢 ${bpm} BPM`;
  } else if (lowNoteList.length > 0) {
    const distinctAsc = [...new Set(lowNoteList.map(n => n.noteNum))].sort((a, b) => a - b);
    const triggerThreshold = distinctAsc.length >= 2 ? distinctAsc[1] : distinctAsc[0];
    el.textContent = `🟠 Next Measure Trigger: <= ${midiToNoteName(triggerThreshold)}`;
  } else {
    el.textContent = `⭕ 1st Measure Trigger: <= ${midiToNoteName(lowNoteThreshold)}`;
  }
}

export function resetIdleClearTimer() {
  if (idleClearTimer !== null) clearTimeout(idleClearTimer);
  idleClearTimer = setTimeout(() => {
    if (measureDurMs === null) {
      lowNoteList.length = 0;
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

export function playDrumPattern(durMs) {
  stopDrumPattern();
  drumMuted = isSilentTilDoubleBass();

  const timeSig = { upperNumeral: beatsPerMeasure, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, beatSubdivision);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = durMs / numDivisions;
  const divisionsPerBeat = numDivisions / beatsPerMeasure;

  drumRunning = true;
  let nextDivIdx = 0;
  let nextFireTime = performance.now();
  drumPatternStartTime = nextFireTime;

  function tick(now) {
    if (!drumRunning) return;

    if (lastMidiEventTime !== null && (now - lastMidiEventTime) > idleMeasures * durMs) {
      console.log('m1i: idle timeout, stopping drums');
      stopDrumPattern();
      measureDurMs = null;
      lowNoteList.length = 0;
      updateMeasureStatus();
      document.getElementById('beat-display').textContent = '–';
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
      nextDivIdx++;
      nextFireTime += divisionMs;
    }

    drumRafId = requestAnimationFrame(tick);
  }

  drumRafId = requestAnimationFrame(tick);
}

// ── event handler ────────────────────────────────────────────────────────────

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';

function handleMeasureTiming(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum > lowNoteThreshold) return;

  if (measureDurMs === null) {
    const distinctAsc = [...new Set(lowNoteList.map(n => n.noteNum))].sort((a, b) => a - b);
    const triggerThreshold = distinctAsc.length >= 2 ? distinctAsc[1] : distinctAsc[0];
    if (distinctAsc.length > 0 && evt.noteNum < triggerThreshold) {
      const dur = evt.time - lowNoteList[0].time;
      console.log('measureDurMs:', dur);
      measureDurMs = dur;
      updateMeasureStatus();
      playDrumPattern(dur);
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
  updateMeasureStatus();
  document.getElementById('beat-display').textContent = '–';
  console.log('reset: drum stopped, measureDurMs cleared');
}
