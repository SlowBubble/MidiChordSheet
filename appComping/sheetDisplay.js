// sheetDisplay.js — renders recorded notes as sheet music via RenderMgr

import { RenderMgr } from '../esModules/sheet-to-song/render.js';
import { Song } from '../esModules/song-sheet/song.js';
import { Voice, clefType } from '../esModules/song-sheet/voice.js';
import { makeSimpleQng, makeRest } from '../esModules/song-sheet/quantizedNoteGp.js';
import { makeFrac } from '../esModules/fraction/fraction.js';
import { isDrumRunning } from './beatStateMgr.js';

// Number of measures to show in the rolling window during live recording.
const RECORDING_WINDOW_MEASURES = 8;

// Grace-note detection thresholds
const GRACE_START_TO_START_MS = 135;  // grace note start to next note start must be within this
const GRACE_END_TO_START_MS = 75;     // grace note end to next note start must be less than this

// Cross-voice chord alignment: notes within this window are considered simultaneous
// and get their onTime unified to the earliest in the group before voice splitting.
const CROSS_VOICE_CHORD_MS = 35;

/**
 * Align notes that are played simultaneously across voices.
 * Any group of notes whose onTimes all fall within CROSS_VOICE_CHORD_MS of the
 * earliest note in the group gets its onTime snapped to that earliest time.
 * This ensures RH and LH notes that belong to the same chord snap to the same grid slot.
 */
function alignCrossVoiceChords(noteOns) {
  if (noteOns.length < 2) return noteOns;
  const sorted = [...noteOns].sort((a, b) => a.onTime - b.onTime);
  const result = sorted.map(n => ({ ...n })); // shallow copy so we don't mutate originals
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
 * Classify noteOns into regular notes and grace notes.
 *
 * A note is a grace note if both:
 *   - (next.onTime - g.onTime) < GRACE_START_TO_START_MS
 *   - (next.onTime - g.offTime) < GRACE_END_TO_START_MS  (can be negative = overlap, that's fine)
 *
 * Returns { regularNotes, graceGroups }
 *   regularNotes: noteOn entries that are NOT grace notes
 *   graceGroups:  Array of { targetOnTime, notes[] }
 */
function classifyGraceNotes(noteOns) {
  if (!noteOns.length) return { regularNotes: noteOns, graceGroups: [] };

  // Sort by onTime for sequential analysis
  const sorted = [...noteOns].sort((a, b) => a.onTime - b.onTime);

  // Grace-note detection runs on individual notes BEFORE any chord grouping,
  // so a grace note played close to another note isn't swallowed into a chord.
  // A note is a grace note if, compared to the very next individual note:
  //   - start-to-start < GRACE_START_TO_START_MS
  //   - end-to-start   < GRACE_END_TO_START_MS  (negative = overlap, fine)
  const isGrace = new Array(sorted.length).fill(false);
  for (let i = 0; i < sorted.length - 1; i++) {
    const n = sorted[i];
    const next = sorted[i + 1];
    const startToStart = next.onTime - n.onTime;
    const endToStart = next.onTime - (n.offTime ?? n.onTime);
    const s2sOk = startToStart < GRACE_START_TO_START_MS;
    const e2sOk = Math.abs(endToStart) < GRACE_END_TO_START_MS;
    if (s2sOk && e2sOk) {
      isGrace[i] = true;
    }
  }

  // Now group non-grace notes into chords (simultaneous within 60ms).
  // Grace notes are kept separate and attached to the first following non-grace note.
  const CHORD_THRESHOLD_MS = 60;
  const regularNotes = [];
  const graceGroups = [];
  let pendingGrace = [];

  // Walk through sorted notes; group consecutive non-grace notes that are simultaneous.
  let i = 0;
  while (i < sorted.length) {
    if (isGrace[i]) {
      pendingGrace.push(sorted[i]);
      i++;
      continue;
    }
    // Start a chord group from this non-grace note
    const chordStart = sorted[i].onTime;
    while (i < sorted.length && !isGrace[i] && sorted[i].onTime - chordStart <= CHORD_THRESHOLD_MS) {
      regularNotes.push(sorted[i]);
      i++;
    }
    // Attach any accumulated grace notes to this chord's onTime
    if (pendingGrace.length) {
      graceGroups.push({ targetOnTime: chordStart, notes: pendingGrace });
      pendingGrace = [];
    }
  }
  // Trailing grace notes with no following real note — treat as regular
  if (pendingGrace.length) regularNotes.push(...pendingGrace);

  return { regularNotes, graceGroups };
}

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
// graceGroups: array of { slotIdx, noteNums[] } — grace notes to insert just before that slot
function slotMapToNoteGps(slotMap, startSlot, numSlots, total8n, graceGroups = []) {
  // Build a map from slotIdx -> list of grace note arrays (each array = one chord of grace notes)
  const graceBySlot = new Map();
  for (const { slotIdx, noteNums } of graceGroups) {
    if (!graceBySlot.has(slotIdx)) graceBySlot.set(slotIdx, []);
    graceBySlot.get(slotIdx).push(noteNums);
  }

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
    const rawEnd8n = makeFrac(s - startSlot + entry.dur16, 2);
    const end8n = rawEnd8n.lessThan(total8n) ? rawEnd8n : total8n;
    if (start8n.greaterThan(cursor8n)) {
      noteGps.push(makeRest(cursor8n, start8n));
    }
    // Insert grace notes just before this slot's real note
    const graceChords = graceBySlot.get(s) || [];
    for (const gnNoteNums of graceChords) {
      noteGps.push(makeSimpleQng(start8n, start8n, gnNoteNums));
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
  let _lastWindowStart8n = null;

  // Track the measure count at the last render so we only re-render once per
  // measure during live recording (not on every beat or subdivision).
  let _lastRenderedMeasureCount = -1;

  function buildAndRender(notes, beats, cursorTime8n = null, recordingWindowMeasureIdx = null) {
    const measureDurMs = noteRecorder.getMeasureDurMs();
    const beatsPerMeasure = noteRecorder.getBeatsPerMeasure();
    const threshold = noteRecorder.getLowNoteThreshold();
    const denom = noteRecorder.getNoteLengthDenom_();
    const measure1StartMs = noteRecorder.getMeasure1StartMs();
    const label = noteRecorder.getLabel();

    if (!beats.length || !notes.length || !measureDurMs || !measure1StartMs) {
      renderMgr.clear();
      _lastSong = null;
      return;
    }

    const noteOns = notes.filter(n => n.onTime != null);

    // Snap simultaneous cross-voice notes to a common onTime before splitting by voice,
    // so RH and LH notes in the same chord always land on the same grid slot.
    const alignedNoteOns = alignCrossVoiceChords(noteOns);

    const earliestNoteTime = alignedNoteOns.length ? Math.min(...alignedNoteOns.map(n => n.onTime)) : null;
    const { grid, sixteenthDurMs, measure1StartMs: gridMeasure1StartMs } = build16thGrid(measure1StartMs, measureDurMs, beatsPerMeasure, earliestNoteTime);
    if (!grid.length) return;

    // Split by voice first, then classify grace notes within each voice independently.
    // This prevents bass trigger notes from being grouped with treble grace notes.
    const rhNoteOnsAll = alignedNoteOns.filter(n => n.noteNum > threshold);
    const lhNoteOnsAll = alignedNoteOns.filter(n => n.noteNum <= threshold);

    const { regularNotes: rhNotes, graceGroups: rhGraceGroupsRaw } = classifyGraceNotes(rhNoteOnsAll);
    const { regularNotes: lhNotes, graceGroups: lhGraceGroupsRaw } = classifyGraceNotes(lhNoteOnsAll);

    const rhMap = buildSlotMap(rhNotes, grid, sixteenthDurMs, denom);
    const lhMap = buildSlotMap(lhNotes, grid, sixteenthDurMs, denom);

    // Convert grace groups' targetOnTime -> slotIdx, filtered to slots that exist in the voice map
    function resolveGraceGroups(graceGroupsRaw, voiceSlotMap) {
      return graceGroupsRaw.flatMap(({ targetOnTime, notes: gnNotes }) => {
        const slotIdx = snapToGrid(targetOnTime, grid);
        if (!voiceSlotMap.has(slotIdx)) return [];
        const noteNums = gnNotes.map(n => n.noteNum).sort((a, b) => a - b);
        return [{ slotIdx, noteNums }];
      });
    }

    const rhGraceGroups = resolveGraceGroups(rhGraceGroupsRaw, rhMap);
    const lhGraceGroups = resolveGraceGroups(lhGraceGroupsRaw, lhMap);

    // A measure is slotsPerMeasure = 16th-notes per measure = beatsPerMeasure * 4.
    const slotsPerMeasure = beatsPerMeasure * 4;
    const measure1Slot0 = Math.round((gridMeasure1StartMs - grid[0]) / sixteenthDurMs);
    const allNoteSlots = [...rhMap.keys(), ...lhMap.keys()];
    const lastNoteSlot = allNoteSlots.length ? Math.max(...allNoteSlots) : measure1Slot0;
    // Find which measure (0-indexed from measure1) the last note falls in.
    let lastNoteMeasureIdx = Math.floor((lastNoteSlot - measure1Slot0) / slotsPerMeasure);

    // Trim the final measure if it only contains rests or notes that are tied over
    // from the previous measure with a duration greater than a quarter note.
    // A note is "tied over" into the final measure if it started in the previous measure
    // and its duration (dur16) exceeds a quarter note (4 sixteenth slots).
    if (lastNoteMeasureIdx > 0) {
      const finalMeasureStart = measure1Slot0 + lastNoteMeasureIdx * slotsPerMeasure;
      const prevMeasureStart  = finalMeasureStart - slotsPerMeasure;

      // Collect all note slots that fall inside the final measure
      const slotsInFinalMeasure = allNoteSlots.filter(
        s => s >= finalMeasureStart && s < finalMeasureStart + slotsPerMeasure
      );

      // A note slot is a "tied-over" entry if it started in the previous measure
      // and its duration extends into (or past) the final measure start, with dur > quarter.
      const isTiedOver = (slotIdx, map) => {
        if (slotIdx >= finalMeasureStart) return false; // starts in final measure, not tied
        const entry = map.get(slotIdx);
        if (!entry) return false;
        const endsAt = slotIdx + entry.dur16;
        return endsAt > finalMeasureStart && entry.dur16 > 4; // dur16 > 4 = longer than quarter
      };

      const rhTiedIntoFinal = [...rhMap.keys()].some(s => isTiedOver(s, rhMap));
      const lhTiedIntoFinal = [...lhMap.keys()].some(s => isTiedOver(s, lhMap));

      // The final measure is trimmable if every voice either:
      //   - has no note starts in the final measure (all rests), OR
      //   - has no note starts in the final measure but has a tied-over note from prev measure
      const rhSlotsInFinal = allNoteSlots.filter(s => rhMap.has(s) && s >= finalMeasureStart);
      const lhSlotsInFinal = allNoteSlots.filter(s => lhMap.has(s) && s >= finalMeasureStart);

      const rhFinalIsEmpty = rhSlotsInFinal.length === 0;
      const lhFinalIsEmpty = lhSlotsInFinal.length === 0;

      // Trim if both voices have no new note starts in the final measure,
      // and at least one voice has a qualifying tied-over note.
      if (rhFinalIsEmpty && lhFinalIsEmpty && (rhTiedIntoFinal || lhTiedIntoFinal)) {
        lastNoteMeasureIdx -= 1;
      }
    }

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

    const rhNoteGps = slotMapToNoteGps(rhMap, startSlot, totalSlots, total8n, rhGraceGroups);
    const lhNoteGps = slotMapToNoteGps(lhMap, startSlot, totalSlots, total8n, lhGraceGroups);

    // Convert recording window measure indices to 8n in the song's coordinate space.
    // Song 8n: 0 = startSlot, so measure1 starts at (measure1Slot0 - startSlot)/2.
    let resolvedWindowStart8n = null;
    let resolvedCursor8n = cursorTime8n;
    let voiceNoteGps = [rhNoteGps, lhNoteGps];
    if (recordingWindowMeasureIdx !== null) {
      const { windowStartMeasureIdx, currentMeasureIdx, windowEndMeasureIdx } = recordingWindowMeasureIdx;
      const measure1Offset8n = makeFrac(measure1Slot0 - startSlot, 2);
      resolvedWindowStart8n = measure1Offset8n.plus(makeFrac(windowStartMeasureIdx * slotsPerMeasure, 2));
      const currentMeasure8n = measure1Offset8n.plus(makeFrac(currentMeasureIdx * slotsPerMeasure, 2));
      const windowEnd8n      = measure1Offset8n.plus(makeFrac(windowEndMeasureIdx * slotsPerMeasure, 2));

      // Extend the song to the full window end so the layout is always 8 measures wide.

      // Replace any note groups at or after the current measure with a single rest,
      // so the current (incomplete) measure shows as blank rather than partial notes.
      // Also track currentMeasure8n for cursor placement.
      let recordingCursor8n = currentMeasure8n;
      voiceNoteGps = [rhNoteGps, lhNoteGps].map(noteGps => {
        const completed = noteGps.filter(qng => qng.end8n.leq(currentMeasure8n));
        // Trim any note that straddles the boundary
        const trimmed = noteGps
          .filter(qng => qng.start8n.lessThan(currentMeasure8n) && qng.end8n.greaterThan(currentMeasure8n))
          .map(qng => {
            const noteNums = qng.getNoteNums();
            return noteNums.length
              ? makeSimpleQng(qng.start8n, currentMeasure8n, noteNums)
              : makeRest(qng.start8n, currentMeasure8n);
          });
        // Fill from currentMeasure8n to windowEnd8n with a rest
        const tail = [makeRest(currentMeasure8n, windowEnd8n)];
        return [...completed, ...trimmed, ...tail];
      });
      resolvedCursor8n = recordingCursor8n;
    }

    const song = new Song({
      title: label || undefined,
      timeSigChanges: { defaultVal: { upperNumeral: beatsPerMeasure, lowerNumeral: 4 } },
      tempo8nPerMinChanges: { defaultVal: tempo8n },
      pickup8n,
      voices: [
        { noteGps: voiceNoteGps[0], clef: clefType.Treble },
        { noteGps: voiceNoteGps[1], clef: clefType.Bass },
      ],
    });

    _lastSong = song;
    _lastGrid = { grid, sixteenthDurMs, gridStartMs: grid[0], measureDurMs, beatsPerMeasure, startSlot, trimmedEndSlot };
    _lastWindowStart8n = resolvedWindowStart8n;

    try {
      renderMgr.render(song, false, resolvedWindowStart8n, resolvedCursor8n);
    } catch (e) {
      console.warn('RenderMgr error:', e);
    }
  }

  noteRecorder.subscribe(({ notes, beats, beatFired, idleFired }) => {
    // When the drum pattern stops (idle), re-render the full sheet with no window.
    if (idleFired) {
      buildAndRender(notes, beats, null, null);
      return;
    }

    // During live recording, only re-render once per measure at beat 1.
    // Both note events and non-downbeat events are suppressed.
    if (isDrumRunning()) {
      if (!beatFired) return; // note event — skip during recording
      const lastBeat = beats[beats.length - 1];
      if (lastBeat.beat !== 1) return; // not the downbeat — skip
      const measureDurMs = noteRecorder.getMeasureDurMs();
      const measure1StartMs = noteRecorder.getMeasure1StartMs();
      if (measureDurMs && measure1StartMs) {
        const measureCount = Math.floor((lastBeat.time - measure1StartMs) / measureDurMs);
        if (measureCount === _lastRenderedMeasureCount) return; // same measure — skip
        _lastRenderedMeasureCount = measureCount;
      }
    }

    // During active recording, compute a rolling window of the last 8 measures
    // and hide the current (incomplete) measure.
    let recordingWindowMeasureIdx = null;
    if (isDrumRunning()) {
      const measureDurMs = noteRecorder.getMeasureDurMs();
      const measure1StartMs = noteRecorder.getMeasure1StartMs();
      const beatsPerMeasure = noteRecorder.getBeatsPerMeasure();
      if (measureDurMs && measure1StartMs && beats.length) {
        const lastBeatTime = beats[beats.length - 1].time;
        const currentMeasureIdx = Math.floor((lastBeatTime - measure1StartMs) / measureDurMs);
        const halfWindow = RECORDING_WINDOW_MEASURES / 2; // 4
        const windowStartMeasureIdx = Math.max(0, Math.floor(currentMeasureIdx / halfWindow) * halfWindow - halfWindow);
        recordingWindowMeasureIdx = { windowStartMeasureIdx, currentMeasureIdx, windowEndMeasureIdx: windowStartMeasureIdx + RECORDING_WINDOW_MEASURES };
      }
    }

    buildAndRender(notes, beats, null, recordingWindowMeasureIdx);
  });

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
        renderMgr.render(_lastSong, false, _lastWindowStart8n, cursor8n);
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
