// replay.js — replays recorded notes and advances the sheet cursor per beat

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import { volume, isReplayDrumbeatDisabled, setReplayMode } from './beatStateMgr.js';
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
  setReplayMode(false); // m4b: clear replay mode flag
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
  setReplayMode(true); // m4b: set replay mode flag

  // Deduplicate recorded beats to one per quarter-note beat (collapse subdivisions).
  const dedupedRecorded = beats.filter((b, i) =>
    i === 0 || b.beat !== beats[i - 1].beat
  );

  // Extrapolate beats for the pickup measure if needed.
  const beatDurMs = measureDurMs ? measureDurMs / beatsPerMeasureVal : 0;
  const firstMeasureBeats = [];
  
  // Check if there are notes in the pickup measure (before the first recorded beat)
  const notesWithOnTime = notes.filter(n => n.onTime != null);
  const earliestNoteOnTime = notesWithOnTime.length > 0 ? Math.min(...notesWithOnTime.map(n => n.onTime)) : null;
  const firstRecordedBeatTime = beats.length > 0 ? beats[0].time : null;
  const hasPickupNotes = earliestNoteOnTime != null && firstRecordedBeatTime != null && 
                         earliestNoteOnTime < firstRecordedBeatTime;
  
  let adjustedOriginTime = originTime;
  
  if (beatDurMs > 0) {
    if (hasPickupNotes && firstRecordedBeatTime != null && earliestNoteOnTime != null) {
      // Generate beats for the pickup measure starting from the earliest note
      // Align beats so they lead up to the first recorded beat
      const pickupDuration = firstRecordedBeatTime - earliestNoteOnTime;
      const beatsNeeded = Math.ceil(pickupDuration / beatDurMs);
      
      // Start beats from earliestNoteOnTime, aligned to the beat grid
      const pickupStartTime = firstRecordedBeatTime - beatsNeeded * beatDurMs;
      
      // Adjust origin time to start from the pickup beat (not a full measure before)
      adjustedOriginTime = Math.min(pickupStartTime, earliestNoteOnTime);
      
      for (let i = 0; i < beatsNeeded; i++) {
        // Beat numbers for pickup: if we need 2 beats in 4/4, they should be beats 3 and 4
        const beatNum = ((beatsPerMeasureVal - beatsNeeded + i) % beatsPerMeasureVal) + 1;
        const beatTime = pickupStartTime + i * beatDurMs;
        firstMeasureBeats.push({ beat: beatNum, time: beatTime });
      }
    } else if (!hasPickupNotes) {
      // No pickup notes: generate a full measure of beats before the first recorded beat
      for (let i = 0; i < beatsPerMeasureVal; i++) {
        firstMeasureBeats.push({ beat: i + 1, time: gridStartMs + i * beatDurMs });
      }
    }
  }

  // Use adjusted origin time for scheduling when there are pickup notes
  const replayOriginTime = adjustedOriginTime;

  // Schedule piano notes (skip anything starting after the trimmed end)
  for (const note of notes) {
    if (note.onTime == null) continue;
    if (trimmedEndMs != null && note.onTime >= trimmedEndMs) continue;
    const onDelay = note.onTime - replayOriginTime;
    const offDelay = note.offTime != null
      ? note.offTime - replayOriginTime
      : onDelay + 500;

    if (onDelay < 0) continue;

    _timeouts.push(setTimeout(() => {
      if (_isReplaying) pianoNoteOn(note.noteNum, note.velocity ?? volume);
    }, onDelay));

    _timeouts.push(setTimeout(() => {
      if (_isReplaying) pianoNoteOff(note.noteNum);
    }, offDelay));
  }
  
  const allBeats = [...firstMeasureBeats, ...dedupedRecorded]
    .filter(b => trimmedEndMs == null || b.time < trimmedEndMs);

  // Schedule cursor advances per beat
  for (const beat of allBeats) {
    const delay = beat.time - replayOriginTime;
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
      const delay = beat.time - replayOriginTime;
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
  }, lastTime - replayOriginTime + 500));
}
