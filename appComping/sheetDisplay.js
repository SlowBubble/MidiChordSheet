// sheetDisplay.js — renders recorded notes as sheet music via RenderMgr

import { RenderMgr } from '../esModules/sheet-to-song/render.js';
import { Song } from '../esModules/song-sheet/song.js';
import { Voice, clefType } from '../esModules/song-sheet/voice.js';
import { makeSimpleQng, makeRest } from '../esModules/song-sheet/quantizedNoteGp.js';
import { makeFrac } from '../esModules/fraction/fraction.js';

// Build a 16th-note grid anchored to the known measure1StartMs.
// measure1StartMs: the exact time of the first trigger note (Date.now() domain).
// Returns { grid, sixteenthDurMs, measure1StartMs }
function build16thGrid(measure1StartMs, measureDurMs, beatsPerMeasure, earliestNoteTime) {
  const beatDurMs = measureDurMs / beatsPerMeasure;
  const sixteenthDurMs = beatDurMs / 4;

  // Grid starts at earliestNoteTime if there are notes before measure1,
  // otherwise at measure1 start. Align to 16th-note grid anchored at measure1StartMs.
  const offsetSlots = earliestNoteTime != null && earliestNoteTime < measure1StartMs
    ? Math.ceil((measure1StartMs - earliestNoteTime) / sixteenthDurMs)
    : 0;
  const start = measure1StartMs - offsetSlots * sixteenthDurMs;

  // Extend grid far enough to cover all beats + a couple of measures buffer
  const endMs = measure1StartMs + measureDurMs * 32; // generous upper bound
  const numSlots = Math.ceil((endMs - start) / sixteenthDurMs) + 1;
  const grid = [];
  for (let i = 0; i < numSlots; i++) grid.push(start + i * sixteenthDurMs);
  return { grid, sixteenthDurMs, measure1StartMs };
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

// Quantize duration in ms to nearest grid multiple based on note-length denominator.
// denom: 16=sixteenth, 8=eighth, 4=quarter, 2=half, 1=whole.
// Returns duration in 16th-note units.
function quantizeDuration(durationMs, sixteenthDurMs, denom) {
  const gridMs = sixteenthDurMs * (16 / denom); // e.g. denom=4 -> gridMs = 4 sixteenths
  const minUnits = 16 / denom;
  if (!durationMs || durationMs <= 0) return minUnits;
  return Math.max(minUnits, Math.round(durationMs / gridMs)) * minUnits;
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
function buildSlotMap(noteList, grid, sixteenthDurMs, denom) {
  const map = new Map();
  const groups = groupSimultaneous(noteList);
  for (const group of groups) {
    const slotIdx = snapToGrid(group[0].onTime, grid);
    const offTimes = group.map(n =>
      n.offTime != null ? n.offTime : n.onTime + sixteenthDurMs
    );
    const avgOffTime = offTimes.reduce((a, b) => a + b, 0) / offTimes.length;
    const dur16 = quantizeDuration(avgOffTime - group[0].onTime, sixteenthDurMs, denom);
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
// slot index -> 8n = (slotIdx - startSlot) / 2
// startSlot: the slot that maps to 8n=0 (either measure1Slot0 or firstNoteSlot for pickups)
function slotMapToNoteGps(slotMap, startSlot, numSlots, total8n) {
  const noteGps = [];
  let cursor8n = makeFrac(0);
  let s = startSlot;
  while (s < numSlots) {
    const entry = slotMap.get(s);
    if (!entry) {
      s++;
      continue;
    }
    const start8n = makeFrac(s - startSlot, 2);
    const end8n = makeFrac(s - startSlot + entry.dur16, 2);
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

export function init(noteRecorder) {
  const canvasDiv = document.getElementById('sheet-display');
  if (!canvasDiv) return;

  const renderMgr = new RenderMgr(canvasDiv);
  let _lastSong = null;
  let _lastGrid = null;

  function buildAndRender(notes, beats, cursorTime8n = null) {
    const measureDurMs = noteRecorder.getMeasureDurMs();
    const beatsPerMeasure = noteRecorder.getBeatsPerMeasure();
    const threshold = noteRecorder.getLowNoteThreshold();
    const denom = noteRecorder.getNoteLengthDenom_();
    const measure1StartMs = noteRecorder.getMeasure1StartMs();

    if (!beats.length || !notes.length || !measureDurMs || !measure1StartMs) {
      renderMgr.clear();
      _lastSong = null;
      return;
    }

    const noteOns = notes.filter(n => n.onTime != null);

    const earliestNoteTime = noteOns.length ? Math.min(...noteOns.map(n => n.onTime)) : null;
    const { grid, sixteenthDurMs, measure1StartMs: gridMeasure1StartMs } = build16thGrid(measure1StartMs, measureDurMs, beatsPerMeasure, earliestNoteTime);
    if (!grid.length) return;

    const rhNotes = noteOns.filter(n => n.noteNum > threshold);
    const lhNotes = noteOns.filter(n => n.noteNum <= threshold);

    const rhMap = buildSlotMap(rhNotes, grid, sixteenthDurMs, denom);
    const lhMap = buildSlotMap(lhNotes, grid, sixteenthDurMs, denom);

    // Trim trailing all-rest measures from the end.
    // A measure is slotsPerMeasure = 16th-notes per measure = beatsPerMeasure * 4.
    const slotsPerMeasure = beatsPerMeasure * 4;
    const measure1Slot0 = Math.round((gridMeasure1StartMs - grid[0]) / sixteenthDurMs);
    const allNoteSlots = [...rhMap.keys(), ...lhMap.keys()];
    const lastNoteSlot = allNoteSlots.length ? Math.max(...allNoteSlots) : measure1Slot0;
    // Find which measure (0-indexed from measure1) the last note falls in.
    const lastNoteMeasureIdx = Math.floor((lastNoteSlot - measure1Slot0) / slotsPerMeasure);
    // Trim grid to end of that measure.
    const trimmedEndSlot = measure1Slot0 + (lastNoteMeasureIdx + 1) * slotsPerMeasure;
    const totalSlots = Math.min(grid.length, trimmedEndSlot);

    const bpmVal = Math.round((beatsPerMeasure / measureDurMs) * 60000);
    const tempo8n = bpmVal * 2;

    // Determine pickup: if any note is before measure1Slot0, the sheet starts there.
    const allSlots = [...rhMap.keys(), ...lhMap.keys()];
    const firstNoteSlot = allSlots.length ? Math.min(...allSlots) : measure1Slot0;
    const startSlot = Math.min(firstNoteSlot, measure1Slot0);
    const pickupSlots = measure1Slot0 - startSlot; // >= 0
    // pickup8n is negative so render.js double-negation works
    const pickup8n = makeFrac(-pickupSlots, 2);
    const total8n = makeFrac(totalSlots - startSlot, 2);

    const rhNoteGps = slotMapToNoteGps(rhMap, startSlot, totalSlots, total8n);
    const lhNoteGps = slotMapToNoteGps(lhMap, startSlot, totalSlots, total8n);

    const song = new Song({
      timeSigChanges: { defaultVal: { upperNumeral: beatsPerMeasure, lowerNumeral: 4 } },
      tempo8nPerMinChanges: { defaultVal: tempo8n },
      pickup8n,
      voices: [
        { noteGps: rhNoteGps, clef: clefType.Treble },
        { noteGps: lhNoteGps, clef: clefType.Bass },
      ],
    });

    _lastSong = song;
    _lastGrid = { grid, sixteenthDurMs, gridStartMs: grid[0], measureDurMs, beatsPerMeasure, startSlot };

    try {
      renderMgr.render(song, false, null, cursorTime8n);
    } catch (e) {
      console.warn('RenderMgr error:', e);
    }
  }

  noteRecorder.subscribe(({ notes, beats }) => buildAndRender(notes, beats));

  // Called by replay to advance the cursor per beat.
  // beatTime: Date.now() ms of the beat; gridStart: ms of grid slot 0.
  return {
    getGridInfo() {
      return _lastGrid;
    },
    renderWithCursor(beatTimeMs) {
      if (!_lastSong || !_lastGrid) return;
      const rawSlot = Math.round((beatTimeMs - _lastGrid.gridStartMs) / _lastGrid.sixteenthDurMs);
      const slotIdx = rawSlot - _lastGrid.startSlot;
      const pickupOffset8n = _lastSong.pickup8n ?? makeFrac(0);
      const rawCursor8n = makeFrac(Math.max(0, slotIdx), 2);
      const cursor8n = rawCursor8n.plus(pickupOffset8n);
      try {
        renderMgr.render(_lastSong, false, null, cursor8n);
      } catch (e) {
        console.warn('RenderMgr cursor error:', e);
      }
    },
    clearCursor() {
      if (!_lastSong) return;
      try {
        renderMgr.render(_lastSong, false, null, null);
      } catch (e) {}
    },
  };
}
