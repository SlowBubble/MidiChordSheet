// replay.js — replays recorded notes and drum beats when space is pressed while idle

import { pianoNoteOn, pianoNoteOff } from './sound.js';
import { volume } from './beatStateMgr.js';

let _timeouts = [];
let _isReplaying = false;

export function isReplaying() { return _isReplaying; }

export function stopReplay() {
  _timeouts.forEach(t => clearTimeout(t));
  _timeouts = [];
  _isReplaying = false;
}

// notes: [{ noteNum, onTime, offTime }]
// beats: [{ beat, time }]
export function startReplay(notes, beats) {
  stopReplay();
  if (!notes.length && !beats.length) return;

  // Find the earliest event time as the replay origin
  const allTimes = [
    ...notes.map(n => n.onTime),
    ...beats.map(b => b.time),
  ];
  const originTime = Math.min(...allTimes);
  const now = Date.now();

  _isReplaying = true;

  // Schedule piano notes
  for (const note of notes) {
    if (note.onTime == null) continue;
    const onDelay = note.onTime - originTime;
    const offDelay = note.offTime != null
      ? note.offTime - originTime
      : onDelay + 500; // default 500ms if never released

    _timeouts.push(setTimeout(() => {
      if (_isReplaying) pianoNoteOn(note.noteNum, note.velocity ?? volume);
    }, onDelay));

    _timeouts.push(setTimeout(() => {
      if (_isReplaying) pianoNoteOff(note.noteNum);
    }, offDelay));
  }

  // Schedule drum beats — display only, no sound
  for (const beat of beats) {
    const delay = beat.time - originTime;
    _timeouts.push(setTimeout(() => {
      if (_isReplaying) {
        document.getElementById('beat-display').textContent = '⚪'.repeat(beat.beat);
      }
    }, delay));
  }

  // Auto-stop after last event
  const lastTime = Math.max(
    ...notes.map(n => n.offTime ?? n.onTime ?? 0),
    ...beats.map(b => b.time),
  );
  const totalDur = lastTime - originTime + 500;
  _timeouts.push(setTimeout(() => stopReplay(), totalDur));
}
