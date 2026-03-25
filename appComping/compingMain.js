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

// m1b: track low notes (noteNum < lowNoteThreshold) to compute measure duration
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
    el.textContent = '🟠 Receiving...';
  } else {
    el.textContent = '⭕ Waiting for data...';
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

// Drum metronome — driven by requestAnimationFrame
let drumRunning = false;
let drumRafId = null;

function reset() {
  drumRunning = false;
  if (drumRafId !== null) {
    cancelAnimationFrame(drumRafId);
    drumRafId = null;
  }
  if (idleClearTimer !== null) {
    clearTimeout(idleClearTimer);
    idleClearTimer = null;
  }
  measureDurMs = null;
  lowNoteList.length = 0;
  updateMeasureStatus();
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
        } else if (evt.type === midiEvent.midiEvtType.NoteOff) {
          MIDI.noteOff(1, evt.noteNum);
        }
        handleMeasureTiming(evt);
      });

      // midi input: measure timing only (no sound)
      midiInputEvtSub(evt => {
        lastMidiEventTime = performance.now();
        resetIdleClearTimer();
        handleMeasureTiming(evt);
      });
    },
  });
}

window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    initMidi();
    reset();
  }
});

function playDrumPattern(durMs) {
  drumRunning = false;
  if (drumRafId !== null) {
    cancelAnimationFrame(drumRafId);
    drumRafId = null;
  }

  const timeSig = { upperNumeral: beatsPerMeasure, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, beatSubdivision);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = durMs / numDivisions;

  drumRunning = true;
  let nextDivIdx = 0;
  let nextFireTime = performance.now();

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
      return;
    }

    while (nextFireTime <= now) {
      const notes = pattern.evtsArrs[nextDivIdx % numDivisions];
      notes.forEach(note => MIDI.noteOn(2, note.noteNum, note.velocity));
      nextDivIdx++;
      nextFireTime += divisionMs;
    }

    drumRafId = requestAnimationFrame(tick);
  }

  drumRafId = requestAnimationFrame(tick);
}

function handleMeasureTiming(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum >= lowNoteThreshold) return;

  const biggestNoteNum = lowNoteList.length > 0
    ? Math.max(...lowNoteList.map(n => n.noteNum))
    : -Infinity;

  if (evt.noteNum < biggestNoteNum && lowNoteList.length > 0 && measureDurMs === null) {
    measureDurMs = evt.time - lowNoteList[0].time;
    console.log('measureDurMs:', measureDurMs);
    updateMeasureStatus();
    playDrumPattern(measureDurMs);
    lowNoteList.length = 0;
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
function updateThresholdDisplay() {
  document.getElementById('threshold-display').textContent = lowNoteThreshold;
}
document.getElementById('incr-threshold-btn').onclick = () => { lowNoteThreshold++; updateThresholdDisplay(); };
document.getElementById('decr-threshold-btn').onclick = () => { if (lowNoteThreshold > 1) { lowNoteThreshold--; updateThresholdDisplay(); } };

// m1i: idle measures controls
function updateIdleMeasuresDisplay() {
  document.getElementById('idle-measures-display').textContent = idleMeasures;
}
document.getElementById('incr-idle-btn').onclick = () => { idleMeasures++; updateIdleMeasuresDisplay(); };
document.getElementById('decr-idle-btn').onclick = () => { if (idleMeasures > 1) { idleMeasures--; updateIdleMeasuresDisplay(); } };
