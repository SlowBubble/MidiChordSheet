import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';
import { genMidiPattern } from '../esModules/musical-beat/pattern.js';

const [midiEvtPub, midiEvtSub] = pubSub.make();

const volume = 120;
const soundfontUrl = '../lib/midi.js/soundfont/';

// m1f: beats per measure and beat subdivision (user-adjustable)
let beatsPerMeasure = 4;
let beatSubdivision = 1;

// m1b: track low notes (noteNum < 60) to compute measure duration
const lowNoteList = []; // each entry: { noteNum, timeMs }

// m1d: measureDurMs computed once; reset via space
let measureDurMs = null;

// Drum metronome — lazily created once MIDI is ready
let drumIntervalId = null;

function reset() {
  if (drumIntervalId !== null) {
    clearInterval(drumIntervalId);
    drumIntervalId = null;
  }
  measureDurMs = null;
  lowNoteList.length = 0;
  console.log('reset: drum stopped, measureDurMs cleared');
}

window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    reset();
  }
});

function startDrumInterval(pattern, numDivisions, divisionMs, startIdx) {
  let idx = startIdx;
  drumIntervalId = setInterval(() => {
    const notes = pattern.evtsArrs[idx % numDivisions];
    notes.forEach(note => {
      MIDI.noteOn(2, note.noteNum, note.velocity);
    });
    idx++;
  }, divisionMs);
}

function playDrumPattern(measureDurMs, measureDurComputedAt) {
  if (drumIntervalId !== null) {
    clearInterval(drumIntervalId);
    drumIntervalId = null;
  }

  // Simple 4/4 time sig object for genMidiPattern
  const timeSig = { upperNumeral: beatsPerMeasure, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, beatSubdivision);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = measureDurMs / numDivisions;
  const beatMs = measureDurMs / beatsPerMeasure; // one beat = one quarter note

  // An unknown latency likely due to drum start taking some time.
  // TODO: May need to allow user to customize since some computers are slower.
  const drumStartLatency = 300;
  // m1e: compute latency between measureDurMs computation and now
  const latency = Date.now() - measureDurComputedAt + drumStartLatency;
  console.log('drum start latency:', latency, 'ms, beatMs:', beatMs);

  // Determine which beat we're in based on latency
  const beatsElapsed = Math.floor(latency / beatMs);
  const nextBeat = beatsElapsed + 1; // 0-indexed beat to start on

  const msIntoCurrentBeat = latency % beatMs;
  const msUntilNextBeat = beatMs - msIntoCurrentBeat;
  const startDivIdx = nextBeat * (numDivisions / 4);

  console.log('skipping', nextBeat, 'beat(s), starting at beat', nextBeat + 1, 'in', msUntilNextBeat, 'ms');
  setTimeout(() => {
    startDrumInterval(pattern, numDivisions, divisionMs, startDivIdx);
  }, msUntilNextBeat);
}

function handleMeasureTiming(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum >= 60) return;

  const biggestNoteNum = lowNoteList.length > 0
    ? Math.max(...lowNoteList.map(n => n.noteNum))
    : -Infinity;

  if (evt.noteNum < biggestNoteNum && lowNoteList.length > 0 && measureDurMs === null) {
    measureDurMs = evt.time - lowNoteList[0].time;
    const measureDurComputedAt = Date.now();
    console.log('measureDurMs computed at', measureDurComputedAt, '— value:', measureDurMs);

    // m1c: trigger 4-beat drum track at the detected tempo
    playDrumPattern(measureDurMs, measureDurComputedAt);

    lowNoteList.length = 0;
  }

  lowNoteList.push({ noteNum: evt.noteNum, time: evt.time });
}

window.onload = () => {
  MIDI.loadPlugin({
    soundfontUrl: soundfontUrl,
    instruments: ['acoustic_grand_piano', 'synth_drum'],
    onsuccess: () => {
      MIDI.setVolume(0, volume);
      // Channel 1 = piano, channel 2 = drums (synth_drum)
      MIDI.programChange(1, MIDI.GM.byName['acoustic_grand_piano'].number);
      MIDI.programChange(2, MIDI.GM.byName['synth_drum'].number);
      MIDI.setVolume(2, volume);

      midiEvtSub(evt => {
        if (evt.type === midiEvent.midiEvtType.NoteOn) {
          MIDI.noteOn(1, evt.noteNum, evt.velocity);
        } else if (evt.type === midiEvent.midiEvtType.NoteOff) {
          MIDI.noteOff(1, evt.noteNum);
        }
        handleMeasureTiming(evt);
      });
    },
  });
};

setupKeyboard(midiEvtPub);

// m1f: beats per measure and subdivision controls
function updateBeatsDisplay() {
  document.getElementById('beats-display').textContent = beatsPerMeasure;
}
function updateSubdivDisplay() {
  document.getElementById('subdiv-display').textContent = beatSubdivision;
}

document.getElementById('incr-beats-btn').onclick = () => {
  beatsPerMeasure++;
  updateBeatsDisplay();
};
document.getElementById('decr-beats-btn').onclick = () => {
  if (beatsPerMeasure > 1) { beatsPerMeasure--; updateBeatsDisplay(); }
};
document.getElementById('incr-subdiv-btn').onclick = () => {
  beatSubdivision++;
  updateSubdivDisplay();
};
document.getElementById('decr-subdiv-btn').onclick = () => {
  if (beatSubdivision > 1) { beatSubdivision--; updateSubdivDisplay(); }
};
