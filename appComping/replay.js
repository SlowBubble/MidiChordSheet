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
