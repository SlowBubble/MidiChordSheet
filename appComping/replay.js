// replay.js — replays recorded notes and advances the sheet cursor per beat

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import { volume, beatsPerMeasure } from './beatStateMgr.js';

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
  // originTime = grid start = one measure before the first drum beat
  // This ensures first-measure cursor events have non-negative delays.
  const gridInfo = _sheetApi?.getGridInfo();
  const savedMeasureDurMs = gridInfo?.measureDurMs;
  const savedBeatsPerMeasure = gridInfo?.beatsPerMeasure ?? beatsPerMeasure;
  const gridStartMs = savedMeasureDurMs && beats.length
    ? beats[0].time - savedMeasureDurMs
    : Math.min(...allTimes);
  const originTime = gridStartMs;

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
  // beats[0].time is the start of measure 2; measure 1 spans [gridStartMs, beats[0].time).
  const beatDurMs = savedMeasureDurMs ? savedMeasureDurMs / savedBeatsPerMeasure : 0;
  const firstMeasureBeats = [];
  if (beatDurMs > 0) {
    for (let i = 0; i < beatsPerMeasure; i++) {
      firstMeasureBeats.push({ beat: i + 1, time: gridStartMs + i * beatDurMs });
    }
  }
  const allBeats = [...firstMeasureBeats, ...dedupedRecorded];

  // Schedule cursor advances per beat (all delays are >= 0 since originTime = gridStartMs)
  for (const beat of allBeats) {
    const delay = beat.time - originTime;
    _timeouts.push(setTimeout(() => {
      if (_isReplaying && _sheetApi) {
        _sheetApi.renderWithCursor(beat.time);
      }
    }, delay));
  }

  // Auto-stop after last event
  const lastTime = Math.max(
    ...notes.map(n => n.offTime ?? n.onTime ?? 0),
    ...beats.map(b => b.time),
  );
  _timeouts.push(setTimeout(() => stopReplay(), lastTime - originTime + 500));
}
