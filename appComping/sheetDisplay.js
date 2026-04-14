// sheetDisplay.js — renders recorded notes as sheet music via RenderMgr

import { RenderMgr } from '../esModules/sheet-to-song/render.js';
import { Song } from '../esModules/song-sheet/song.js';
import { Voice, clefType } from '../esModules/song-sheet/voice.js';
import { makeSimpleQng, makeRest } from '../esModules/song-sheet/quantizedNoteGp.js';
import { makeFrac } from '../esModules/fraction/fraction.js';

// Build a 16th-note grid extrapolated one measure before beats[0].
function build16thGrid(beats, measureDurMs, beatsPerMeasure) {
  if (!beats.length) return { grid: [], sixteenthDurMs: 0 };
  const beatDurMs = measureDurMs / beatsPerMeasure;
  const sixteenthDurMs = beatDurMs / 4;
  const anchor = beats[0].time;
  const start = anchor - measureDurMs;
  const lastBeat = beats[beats.length - 1];
  const totalMs = (lastBeat.time - start) + measureDurMs;
  const numSlots = Math.ceil(totalMs / sixteenthDurMs) + 1;
  const grid = [];
  for (let i = 0; i < numSlots; i++) grid.push(start + i * sixteenthDurMs);
  return { grid, sixteenthDurMs };
}

// Snap a time to the nearest slot index in a sorted grid.
function snapToGrid(timeMs, grid) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < grid.length; i++) {
    const d = Math.abs(timeMs - grid[i]);
    if (d < bestDist) { bestDist = d; best = i; }
    else break;
  }
  return best;
}

// Quantize duration in ms to nearest 8th-note multiple (min 1 eighth = 2 sixteenths).
// Returns duration in 16th-note units.
function quantizeDuration(durationMs, sixteenthDurMs) {
  if (!durationMs || durationMs <= 0) return 2;
  const eighthDurMs = sixteenthDurMs * 2;
  return Math.max(1, Math.round(durationMs / eighthDurMs)) * 2;
}

// Group NoteOn events within 60ms of each other as simultaneous (chord).
function groupSimultaneous(noteOns, thresholdMs = 60) {
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

// Build slotMap: slotIdx -> { noteNums: Set, dur16 }, with overlap truncation.
function buildSlotMap(noteList, grid, sixteenthDurMs) {
  const map = new Map();
  const groups = groupSimultaneous(noteList);
  for (const group of groups) {
    const slotIdx = snapToGrid(group[0].onTime, grid);
    const offTimes = group.map(n =>
      n.offTime != null ? n.offTime : n.onTime + sixteenthDurMs
    );
    const avgOffTime = offTimes.reduce((a, b) => a + b, 0) / offTimes.length;
    const dur16 = quantizeDuration(avgOffTime - group[0].onTime, sixteenthDurMs);
    if (!map.has(slotIdx)) map.set(slotIdx, { noteNums: new Set(), dur16 });
    const entry = map.get(slotIdx);
    entry.dur16 = Math.max(entry.dur16, dur16);
    for (const n of group) entry.noteNums.add(n.noteNum);
  }
  // Truncate notes that overlap the next note's slot
  const slots = [...map.keys()].sort((a, b) => a - b);
  for (let i = 0; i < slots.length - 1; i++) {
    const entry = map.get(slots[i]);
    if (slots[i] + entry.dur16 > slots[i + 1]) {
      entry.dur16 = Math.max(1, slots[i + 1] - slots[i]);
    }
  }
  return map;
}

// Convert slotMap + grid length into an array of QuantizedNoteGp, with rests filling gaps.
// slot index -> 8n = slotIdx / 2
function slotMapToNoteGps(slotMap, numSlots, total8n) {
  const noteGps = [];
  let cursor8n = makeFrac(0);
  let s = 0;
  while (s < numSlots) {
    const entry = slotMap.get(s);
    if (!entry) {
      s++;
      continue;
    }
    const start8n = makeFrac(s, 2);
    const end8n = makeFrac(s + entry.dur16, 2);
    if (start8n.greaterThan(cursor8n)) {
      noteGps.push(makeRest(cursor8n, start8n));
    }
    const noteNums = [...entry.noteNums].sort((a, b) => a - b);
    noteGps.push(makeSimpleQng(start8n, end8n, noteNums));
    cursor8n = end8n;
    s += entry.dur16;
  }
  // Fill trailing rest to end of grid
  if (cursor8n.lessThan(total8n)) {
    noteGps.push(makeRest(cursor8n, total8n));
  }
  return noteGps;
}

export function init(noteRecorder, beatStateMgr) {
  const canvasDiv = document.getElementById('sheet-display');
  if (!canvasDiv) return;

  const renderMgr = new RenderMgr(canvasDiv);

  noteRecorder.subscribe(({ notes, beats }) => {
    const beatsPerMeasure = beatStateMgr.beatsPerMeasure;
    const measureDurMs = beatStateMgr.measureDurMs;

    if (!beats.length || !notes.length || !measureDurMs) {
      renderMgr.clear();
      return;
    }

    const { grid, sixteenthDurMs } = build16thGrid(beats, measureDurMs, beatsPerMeasure);
    if (!grid.length) return;

    const noteOns = notes.filter(n => n.onTime != null);
    const threshold = beatStateMgr.lowNoteThreshold;
    const rhNotes = noteOns.filter(n => n.noteNum > threshold);
    const lhNotes = noteOns.filter(n => n.noteNum <= threshold);

    const rhMap = buildSlotMap(rhNotes, grid, sixteenthDurMs);
    const lhMap = buildSlotMap(lhNotes, grid, sixteenthDurMs);

    const totalSlots = grid.length;
    const total8n = makeFrac(totalSlots, 2);

    const rhNoteGps = slotMapToNoteGps(rhMap, totalSlots, total8n);
    const lhNoteGps = slotMapToNoteGps(lhMap, totalSlots, total8n);

    const bpmVal = Math.round((beatsPerMeasure / measureDurMs) * 60000);
    // tempo8nPerMinChanges uses 8th notes per minute
    const tempo8n = bpmVal * 2;

    const song = new Song({
      timeSigChanges: { defaultVal: { upperNumeral: beatsPerMeasure, lowerNumeral: 4 } },
      tempo8nPerMinChanges: { defaultVal: tempo8n },
      // pickup = one measure before beat 0, expressed in 8th notes
      pickup8n: makeFrac(beatsPerMeasure * 2),
      voices: [
        { noteGps: rhNoteGps, clef: clefType.Treble },
        { noteGps: lhNoteGps, clef: clefType.Bass },
      ],
    });

    try {
      renderMgr.render(song);
    } catch (e) {
      console.warn('RenderMgr error:', e);
    }
  });
}
