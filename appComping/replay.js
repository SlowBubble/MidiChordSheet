// replay.js — replays recorded notes and advances the sheet cursor per beat

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import { volume, scheduleReplayDrums } from './beatStateMgr.js';
import * as noteRecorder from './noteRecorder.js';

let _timeouts = [];
let _isReplaying = false;
let _sheetApi = null;

export function setSheetApi(api) { _sheetApi = api; }

export function isReplaying() { return _isReplaying; }

export function stopReplay() {
  _timeouts.forEach(t => clearTimeout(t));
  _timeouts = [];
  _isReplaying = false;
  _sheetApi?.clearCursor();
  const beatDisplay = document.getElementById('beat-display');
  if (beatDisplay) beatDisplay.textContent = '';
}

// notes: [{ noteNum, velocity, onTime, offTime }]
// beats: [{ beat, time }]
export function startReplay(notes, beats) {
  stopReplay();
  if (!notes.length && !beats.length) return;

  const allTimes = [
    ...notes.map(n => n.onTime),
    ...beats.map(b => b.time),
  ];
  const gridInfo = _sheetApi?.getGridInfo();
  const measureDurMs = noteRecorder.getMeasureDurMs();
  const beatsPerMeasureVal = noteRecorder.getBeatsPerMeasure();
  const beatSubdivisionVal = noteRecorder.getBeatSubdivision();
  const measure1StartMs = noteRecorder.getMeasure1StartMs();
  const gridStartMs = measureDurMs && beats.length
    ? beats[0].time - measureDurMs
    : Math.min(...allTimes);
  const earliestNoteTime = notes.length ? Math.min(...notes.map(n => n.onTime)) : gridStartMs;
  const originTime = Math.min(gridStartMs, earliestNoteTime);

  _startReplayFrom(notes, beats, originTime, gridStartMs, measureDurMs, beatsPerMeasureVal, beatSubdivisionVal, measure1StartMs, gridInfo);
}

// Like startReplay but starts drums one measure early as a count-in.
// Used by gamify mode — no piano notes, just drums.
export function startGamifyReplay(beats) {
  stopReplay();
  if (!beats.length) return;

  const measureDurMs = noteRecorder.getMeasureDurMs();
  const beatsPerMeasureVal = noteRecorder.getBeatsPerMeasure();
  const beatSubdivisionVal = noteRecorder.getBeatSubdivision();
  const measure1StartMs = noteRecorder.getMeasure1StartMs();
  const gridInfo = _sheetApi?.getGridInfo();

  if (!measureDurMs || !measure1StartMs) return;

  // Remap all timestamps so that the count-in measure starts right now.
  // originalMeasure1 is the recorded measure1StartMs; we want it to fire
  // measureDurMs ms from now (after the count-in).
  const now = Date.now();
  const countInStart = now;                        // count-in measure starts immediately
  const newMeasure1StartMs = now + measureDurMs;   // measure 1 starts one measure from now

  // Compute the time offset between original and remapped timestamps.
  const timeShift = newMeasure1StartMs - measure1StartMs;

  // Remap beats to new timestamps (for cursor advances).
  const remappedBeats = beats.map(b => ({ ...b, time: b.time + timeShift }));

  // originTime for delay calculation: delays = fireTime - originTime = fireTime - now
  const originTime = now;

  // Schedule the count-in measure (one measure before newMeasure1StartMs).
  const countInIds = scheduleReplayDrums(countInStart, measureDurMs, 1, originTime, beatsPerMeasureVal, beatSubdivisionVal);

  // Schedule the main drum pattern starting at newMeasure1StartMs.
  const lastBeatTime = remappedBeats.length ? remappedBeats[remappedBeats.length - 1].time : newMeasure1StartMs + measureDurMs;
  let numMeasures = Math.ceil((lastBeatTime - newMeasure1StartMs) / measureDurMs) + 1;
  if (gridInfo && gridInfo.trimmedEndSlot != null) {
    const trimmedEndMs = gridInfo.gridStartMs + gridInfo.trimmedEndSlot * gridInfo.sixteenthDurMs;
    numMeasures = Math.ceil((trimmedEndMs - measure1StartMs) / measureDurMs);
  }
  const mainDrumIds = scheduleReplayDrums(newMeasure1StartMs, measureDurMs, numMeasures, originTime, beatsPerMeasureVal, beatSubdivisionVal);

  _isReplaying = true;
  _timeouts.push(...countInIds, ...mainDrumIds);

  // Schedule cursor advances using remapped beat times.
  const dedupedRecorded = remappedBeats.filter((b, i) =>
    i === 0 || b.beat !== remappedBeats[i - 1].beat
  );
  const beatDurMs = measureDurMs / beatsPerMeasureVal;
  const firstMeasureBeats = [];
  for (let i = 0; i < beatsPerMeasureVal; i++) {
    firstMeasureBeats.push({ beat: i + 1, time: newMeasure1StartMs + i * beatDurMs });
  }
  for (const beat of [...firstMeasureBeats, ...dedupedRecorded]) {
    const delay = beat.time - originTime;
    _timeouts.push(setTimeout(() => {
      if (_isReplaying && _sheetApi) _sheetApi.renderWithCursor(beat.time - timeShift);
    }, delay));
  }

  // Auto-stop after last beat.
  const lastTime = remappedBeats.length ? remappedBeats[remappedBeats.length - 1].time : newMeasure1StartMs + measureDurMs;
  _timeouts.push(setTimeout(() => stopReplay(), lastTime - originTime + 500));
}

function _startReplayFrom(notes, beats, originTime, gridStartMs, measureDurMs, beatsPerMeasureVal, beatSubdivisionVal, measure1StartMs, gridInfo) {

  _isReplaying = true;

  // Schedule piano notes
  for (const note of notes) {
    if (note.onTime == null) continue;
    const onDelay = note.onTime - originTime;
    const offDelay = note.offTime != null
      ? note.offTime - originTime
      : onDelay + 500;

    _timeouts.push(setTimeout(() => {
      if (_isReplaying) pianoNoteOn(note.noteNum, note.velocity ?? volume);
    }, onDelay));

    _timeouts.push(setTimeout(() => {
      if (_isReplaying) pianoNoteOff(note.noteNum);
    }, offDelay));
  }

  // Deduplicate recorded beats to one per quarter-note beat (collapse subdivisions).
  const dedupedRecorded = beats.filter((b, i) =>
    i === 0 || b.beat !== beats[i - 1].beat
  );

  // Extrapolate first-measure beats using the true beat duration.
  const beatDurMs = measureDurMs ? measureDurMs / beatsPerMeasureVal : 0;
  const firstMeasureBeats = [];
  if (beatDurMs > 0) {
    for (let i = 0; i < beatsPerMeasureVal; i++) {
      firstMeasureBeats.push({ beat: i + 1, time: gridStartMs + i * beatDurMs });
    }
  }
  const allBeats = [...firstMeasureBeats, ...dedupedRecorded];

  // Schedule cursor advances per beat
  for (const beat of allBeats) {
    const delay = beat.time - originTime;
    _timeouts.push(setTimeout(() => {
      if (_isReplaying && _sheetApi) {
        _sheetApi.renderWithCursor(beat.time);
      }
    }, delay));
  }

  // Schedule drum pattern across all recorded measures
  if (measureDurMs && measure1StartMs) {
    const lastBeatTime = beats.length ? beats[beats.length - 1].time : measure1StartMs + measureDurMs;
    const numMeasures = Math.ceil((lastBeatTime - measure1StartMs) / measureDurMs) + 1;

    // Cap to the trimmed song end if the sheet has been rendered.
    // gridInfo.trimmedEndSlot is in 16th-note slots from grid[0]; convert to ms.
    let cappedNumMeasures = numMeasures;
    if (gridInfo && gridInfo.trimmedEndSlot != null) {
      const trimmedEndMs = gridInfo.gridStartMs + gridInfo.trimmedEndSlot * gridInfo.sixteenthDurMs;
      cappedNumMeasures = Math.ceil((trimmedEndMs - measure1StartMs) / measureDurMs);
    }

    const drumIds = scheduleReplayDrums(measure1StartMs, measureDurMs, cappedNumMeasures, originTime, beatsPerMeasureVal, beatSubdivisionVal);
    _timeouts.push(...drumIds);
  }

  // Auto-stop after last event
  const lastTime = Math.max(
    ...notes.map(n => n.offTime ?? n.onTime ?? 0),
    ...beats.map(b => b.time),
  );
  _timeouts.push(setTimeout(() => stopReplay(), lastTime - originTime + 500));
}
