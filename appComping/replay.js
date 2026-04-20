// replay.js — replays recorded notes and advances the sheet cursor per beat

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import { volume, isReplayDrumbeatDisabled } from './beatStateMgr.js';
import { drumNoteOn } from './sound.js';
import * as noteRecorder from './noteRecorder.js';

const BASS_DRUM = 35;
const SNARE_CROSS_STICK = 37;
const HI_HAT_CLOSED = 42;
const BASS_DRUM_VELOCITY = 100;
const SNARE_CROSS_STICK_VELOCITY = 30;
const HI_HAT_VELOCITY = 30;

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
  const gridStartMs = measureDurMs && beats.length
    ? beats[0].time - measureDurMs
    : Math.min(...allTimes);
  const earliestNoteTime = notes.length ? Math.min(...notes.map(n => n.onTime)) : gridStartMs;
  const originTime = Math.min(gridStartMs, earliestNoteTime);

  // Trimmed end: the sheet drops the last measure if it's all rests/tied notes.
  // Convert trimmedEndSlot back to a Date.now() ms cutoff so replay ends at the same point.
  const trimmedEndMs = (gridInfo && gridInfo.trimmedEndSlot != null)
    ? gridInfo.gridStartMs + gridInfo.trimmedEndSlot * gridInfo.sixteenthDurMs
    : null;

  _isReplaying = true;

  // Schedule piano notes (skip anything starting after the trimmed end)
  for (const note of notes) {
    if (note.onTime == null) continue;
    if (trimmedEndMs != null && note.onTime >= trimmedEndMs) continue;
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
  const allBeats = [...firstMeasureBeats, ...dedupedRecorded]
    .filter(b => trimmedEndMs == null || b.time < trimmedEndMs);

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
  if (!isReplayDrumbeatDisabled()) {
    const beatDisplay = document.getElementById('beat-display');
    for (const beat of allBeats) {
      const delay = beat.time - originTime;
      if (delay < 0) continue;
      _timeouts.push(setTimeout(() => {
        if (_isReplaying) {
          const isDownbeat = beat.beat === 1;
          const isLastBeat = beat.beat === beatsPerMeasureVal;
          const noteNum = isDownbeat ? BASS_DRUM : isLastBeat ? SNARE_CROSS_STICK : HI_HAT_CLOSED;
          const velocity = isDownbeat ? BASS_DRUM_VELOCITY : isLastBeat ? SNARE_CROSS_STICK_VELOCITY : HI_HAT_VELOCITY;
          drumNoteOn(noteNum, velocity);
          if (beatDisplay) beatDisplay.textContent = '⚪'.repeat(beat.beat);
        }
      }, delay));
    }
  }

  // Auto-stop after last event (capped to trimmed end if available)
  const lastNoteTime = Math.max(
    ...notes.map(n => n.offTime ?? n.onTime ?? 0),
    ...beats.map(b => b.time),
  );
  const lastTime = trimmedEndMs != null ? Math.min(lastNoteTime, trimmedEndMs) : lastNoteTime;
  const firstBeatTime = allBeats.length ? allBeats[0].time : null;
  _timeouts.push(setTimeout(() => {
    stopReplay();
    // Return cursor to the beginning of the piece
    if (firstBeatTime != null) _sheetApi?.setStartCursor(firstBeatTime);
  }, lastTime - originTime + 500));
}
