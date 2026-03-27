import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';
import { genMidiPattern } from '../esModules/musical-beat/pattern.js';
import * as midiInput from '../esModules/fire/midiInput.js';

const [keyboardEvtPub, keyboardEvtSub] = pubSub.make();
const [midiInputEvtPub, midiInputEvtSub] = pubSub.make();

const volume = 120;
const soundfontUrl = '../lib/midi.js/soundfont/';

// m1f: beats per measure and beat subdivision (user-adjustable)
let beatsPerMeasure = 4;
let beatSubdivision = 1;

// m1h: configurable low-note threshold (default 62)
let lowNoteThreshold = 62;

// m1i: stop drums after this many idle measures with no midi events
let idleMeasures = 1;
let lastMidiEventTime = null;

// silent-til-double-bass: track recent bass note-on times and mute state
const bassNoteOnTimes = new Map(); // noteNum -> timestamp
let drumMuted = false;
let pendingUnmuteTimer = null;

// mute-if-double-soprano: track recent soprano note-on times and pending mute
const sopranoNoteOnTimes = new Map(); // noteNum -> timestamp
const highNoteThreshold = 72;
let pendingMuteTimer = null;

// m1b: track low notes (noteNum <= lowNoteThreshold) to compute measure duration
const lowNoteList = []; // each entry: { noteNum, timeMs }

// m1d: measureDurMs computed once; reset via space
let measureDurMs = null;

// idle timer to clear lowNoteList after 2s of no events
let idleClearTimer = null;

function updateMeasureStatus() {
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

function resetIdleClearTimer() {
  if (idleClearTimer !== null) clearTimeout(idleClearTimer);
  idleClearTimer = setTimeout(() => {
    if (measureDurMs === null) {
      lowNoteList.length = 0;
      updateMeasureStatus();
    }
    idleClearTimer = null;
  }, 2000);
}

function getUrlParam(key) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get(key);
}

function setUrlParam(key, val) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (val !== undefined && val !== null) {
    params.set(key, val);
  } else {
    params.delete(key);
  }
  const newHash = params.toString();
  history.replaceState(null, '', newHash ? '#' + newHash : window.location.pathname);
}

function isSilentTilDoubleBass() {
  return document.getElementById('silent-til-double-bass-cb')?.checked;
}

function isMuteIfDoubleSoprano() {
  return document.getElementById('mute-if-double-soprano-cb')?.checked;
}

function checkDoubleBassUnmute(noteNum, now) {
  if (!isSilentTilDoubleBass() || !drumMuted) return;
  if (noteNum > lowNoteThreshold) return;

  // Record this bass note-on time
  bassNoteOnTimes.set(noteNum, now);

  // Check if any other bass note exactly 12 semitones away fired within 300ms
  const octavePair = [noteNum - 12, noteNum + 12];
  for (const partner of octavePair) {
    const partnerTime = bassNoteOnTimes.get(partner);
    if (partnerTime !== undefined && Math.abs(now - partnerTime) <= 300) {
      scheduleUnmute(now);
      return;
    }
  }
}

function checkDoubleSopranoMute(noteNum, now) {
  if (!isMuteIfDoubleSoprano() || drumMuted) return;
  if (noteNum < highNoteThreshold) return;

  sopranoNoteOnTimes.set(noteNum, now);

  const octavePair = [noteNum - 12, noteNum + 12];
  for (const partner of octavePair) {
    const partnerTime = sopranoNoteOnTimes.get(partner);
    if (partnerTime !== undefined && Math.abs(now - partnerTime) <= 300) {
      scheduleMute(now);
      return;
    }
  }
}

function scheduleUnmute(now) {
  if (pendingUnmuteTimer !== null) return; // already scheduled
  if (measureDurMs === null || drumPatternStartTime === null) {
    // drums not running yet, unmute immediately
    drumMuted = false;
    return;
  }

  const beatDurMs = measureDurMs / beatsPerMeasure;
  const finalBeat = beatsPerMeasure - 1; // 0-indexed

  let delayMs;
  if (drumCurrentBeat >= finalBeat) {
    // Already in the final beat — unmute at beat 1 of the next measure
    const elapsed = (now - drumPatternStartTime) % measureDurMs;
    delayMs = measureDurMs - elapsed;
  } else {
    // Unmute at the start of the final beat
    const elapsed = (now - drumPatternStartTime) % measureDurMs;
    delayMs = (finalBeat * beatDurMs) - elapsed;
  }

  pendingUnmuteTimer = setTimeout(() => {
    drumMuted = false;
    pendingUnmuteTimer = null;
  }, Math.max(0, delayMs));
}

function scheduleMute(now) {
  if (pendingMuteTimer !== null) return; // already scheduled
  if (measureDurMs === null || drumPatternStartTime === null) {
    drumMuted = true;
    return;
  }

  // Mute at the start of the next measure
  const elapsed = (now - drumPatternStartTime) % measureDurMs;
  const delayMs = measureDurMs - elapsed;

  pendingMuteTimer = setTimeout(() => {
    drumMuted = true;
    pendingMuteTimer = null;
  }, Math.max(0, delayMs));
}


let drumRunning = false;
let drumRafId = null;
let drumPatternStartTime = null; // performance.now() when current pattern started
let drumCurrentBeat = 0; // 0-indexed current beat within measure

function reset() {
  drumRunning = false;
  if (drumRafId !== null) {
    cancelAnimationFrame(drumRafId);
    drumRafId = null;
  }
  if (pendingUnmuteTimer !== null) {
    clearTimeout(pendingUnmuteTimer);
    pendingUnmuteTimer = null;
  }
  if (idleClearTimer !== null) {
    clearTimeout(idleClearTimer);
    idleClearTimer = null;
  }
  measureDurMs = null;
  lowNoteList.length = 0;
  bassNoteOnTimes.clear();
  sopranoNoteOnTimes.clear();
  drumPatternStartTime = null;
  drumCurrentBeat = 0;
  drumMuted = false;
  if (pendingMuteTimer !== null) {
    clearTimeout(pendingMuteTimer);
    pendingMuteTimer = null;
  }
  updateMeasureStatus();
  document.getElementById('beat-display').textContent = '–';
  console.log('reset: drum stopped, measureDurMs cleared');
}

// m2a: init MIDI lazily on first Space press (satisfies AudioContext user gesture requirement)
let midiReady = false;

function initMidi() {
  if (midiReady) return;
  midiReady = true;
  const statusEl = document.getElementById('status');
  statusEl.textContent = '🔴 Loading audio...';
  MIDI.loadPlugin({
    soundfontUrl: soundfontUrl,
    instruments: ['acoustic_grand_piano', 'synth_drum'],
    onsuccess: () => {
      MIDI.setVolume(0, volume);
      // Channel 1 = piano, channel 2 = drums (synth_drum)
      MIDI.programChange(1, MIDI.GM.byName['acoustic_grand_piano'].number);
      MIDI.programChange(2, MIDI.GM.byName['synth_drum'].number);
      MIDI.setVolume(2, volume);
      statusEl.textContent = 'Audio: ready \u2713';
      updateMeasureStatus();
      statusEl.className = 'status status-green';

      // keyboard: sound + measure timing
      keyboardEvtSub(evt => {
        lastMidiEventTime = performance.now();
        resetIdleClearTimer();
        if (evt.type === midiEvent.midiEvtType.NoteOn) {
          MIDI.noteOn(1, evt.noteNum, evt.velocity);
          checkDoubleBassUnmute(evt.noteNum, performance.now());
          checkDoubleSopranoMute(evt.noteNum, performance.now());
        } else if (evt.type === midiEvent.midiEvtType.NoteOff) {
          MIDI.noteOff(1, evt.noteNum);
        }
        handleMeasureTiming(evt);
      });

      // midi input: measure timing only (no sound)
      midiInputEvtSub(evt => {
        lastMidiEventTime = performance.now();
        resetIdleClearTimer();
        if (evt.type === midiEvent.midiEvtType.NoteOn) {
          checkDoubleBassUnmute(evt.noteNum, performance.now());
          checkDoubleSopranoMute(evt.noteNum, performance.now());
        }
        handleMeasureTiming(evt);
      });
    },
  });
}

window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    reset();
  }
  initMidi();
});

function playDrumPattern(durMs) {
  drumRunning = false;
  if (drumRafId !== null) {
    cancelAnimationFrame(drumRafId);
    drumRafId = null;
  }

  // silent-til-double-bass: start muted if checkbox is on
  drumMuted = isSilentTilDoubleBass();

  const timeSig = { upperNumeral: beatsPerMeasure, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, beatSubdivision);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = durMs / numDivisions;

  drumRunning = true;
  let nextDivIdx = 0;
  let nextFireTime = performance.now();
  drumPatternStartTime = nextFireTime;
  const divisionsPerBeat = numDivisions / beatsPerMeasure;

  function tick(now) {
    if (!drumRunning) return;

    // m1i: stop if no midi events for idleMeasures * measureDurMs
    if (lastMidiEventTime !== null && (now - lastMidiEventTime) > idleMeasures * durMs) {
      console.log('m1i: idle timeout, stopping drums');
      drumRunning = false;
      drumRafId = null;
      measureDurMs = null;
      lowNoteList.length = 0;
      updateMeasureStatus();
      document.getElementById('beat-display').textContent = '–';
      return;
    }

    while (nextFireTime <= now) {
      const divInMeasure = nextDivIdx % numDivisions;
      const beat = Math.floor(divInMeasure / divisionsPerBeat) + 1;
      drumCurrentBeat = beat - 1; // 0-indexed
      document.getElementById('beat-display').textContent = '⚪'.repeat(beat);
      const notes = pattern.evtsArrs[divInMeasure];
      notes.forEach(note => MIDI.noteOn(2, note.noteNum, drumMuted ? 0 : note.velocity));
      nextDivIdx++;
      nextFireTime += divisionMs;
    }

    drumRafId = requestAnimationFrame(tick);
  }

  drumRafId = requestAnimationFrame(tick);
}

function handleMeasureTiming(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum > lowNoteThreshold) return;

  if (measureDurMs === null) {
    // m2b: build sorted distinct note numbers seen so far
    const distinctAsc = [...new Set(lowNoteList.map(n => n.noteNum))].sort((a, b) => a - b);

    // trigger when N < n2 (second distinct note), or N < n1 if only one distinct note seen
    const triggerThreshold = distinctAsc.length >= 2 ? distinctAsc[1] : distinctAsc[0];

    if (distinctAsc.length > 0 && evt.noteNum < triggerThreshold) {
      measureDurMs = evt.time - lowNoteList[0].time;
      console.log('measureDurMs:', measureDurMs);
      updateMeasureStatus();
      playDrumPattern(measureDurMs);
      lowNoteList.length = 0;
    }
  }

  lowNoteList.push({ noteNum: evt.noteNum, time: evt.time });
  updateMeasureStatus();
}

setupKeyboard(keyboardEvtPub);

// m2a: real MIDI input triggers measure timing only, no sound
midiInput.setup(
  (notes, timeMs) => {
    notes.forEach(noteNum => {
      midiInputEvtPub(new midiEvent.NoteOnEvt({ noteNum, velocity: volume, channelNum: 0, time: timeMs }));
    });
  },
  (notes, timeMs) => {
    notes.forEach(noteNum => {
      midiInputEvtPub(new midiEvent.NoteOffEvt({ noteNum, channelNum: 0, time: timeMs }));
    });
  },
  () => {},
);

// m1f: beats per measure and subdivision controls
function updateBeatsDisplay() {
  document.getElementById('beats-display').textContent = beatsPerMeasure;
}
function updateSubdivDisplay() {
  document.getElementById('subdiv-display').textContent = beatSubdivision;
}

document.getElementById('incr-beats-btn').onclick = () => { beatsPerMeasure++; updateBeatsDisplay(); };
document.getElementById('decr-beats-btn').onclick = () => { if (beatsPerMeasure > 1) { beatsPerMeasure--; updateBeatsDisplay(); } };
document.getElementById('incr-subdiv-btn').onclick = () => { beatSubdivision++; updateSubdivDisplay(); };
document.getElementById('decr-subdiv-btn').onclick = () => { if (beatSubdivision > 1) { beatSubdivision--; updateSubdivDisplay(); } };

// m1h: low-note threshold controls
function midiToNoteName(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[midi % 12] + Math.floor(midi / 12 - 1);
}
function updateThresholdDisplay() {
  document.getElementById('threshold-display').textContent = midiToNoteName(lowNoteThreshold);
}
document.getElementById('incr-threshold-btn').onclick = () => { lowNoteThreshold++; updateThresholdDisplay(); };
document.getElementById('decr-threshold-btn').onclick = () => { if (lowNoteThreshold > 1) { lowNoteThreshold--; updateThresholdDisplay(); } };

// m1i: idle measures controls
function updateIdleMeasuresDisplay() {
  document.getElementById('idle-measures-display').textContent = idleMeasures;
}
document.getElementById('incr-idle-btn').onclick = () => { idleMeasures++; updateIdleMeasuresDisplay(); };
document.getElementById('decr-idle-btn').onclick = () => { if (idleMeasures > 1) { idleMeasures--; updateIdleMeasuresDisplay(); } };

// silent-til-double-bass: persist via URL param
const silentCb = document.getElementById('silent-til-double-bass-cb');
if (getUrlParam('SilentTilDoubleBass') === '1') {
  silentCb.checked = true;
}
silentCb.onchange = () => {
  setUrlParam('SilentTilDoubleBass', silentCb.checked ? '1' : null);
};

// mute-if-double-soprano: persist via URL param
const muteSopranoCb = document.getElementById('mute-if-double-soprano-cb');
if (getUrlParam('MuteIfDoubleSoprano') === '1') {
  muteSopranoCb.checked = true;
}
muteSopranoCb.onchange = () => {
  setUrlParam('MuteIfDoubleSoprano', muteSopranoCb.checked ? '1' : null);
};
