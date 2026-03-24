import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';
import { genMidiPattern } from '../esModules/musical-beat/pattern.js';

const [midiEvtPub, midiEvtSub] = pubSub.make();

const volume = 120;
const soundfontUrl = '../lib/midi.js/soundfont/';

// m1b: track low notes (noteNum < 60) to compute measure duration
const lowNoteList = []; // each entry: { noteNum, timeMs }

// Drum metronome — lazily created once MIDI is ready
let drumIntervalId = null;

function playDrumPattern(measureDurMs) {
  if (drumIntervalId !== null) {
    clearInterval(drumIntervalId);
    drumIntervalId = null;
  }

  // Simple 4/4 time sig object for genMidiPattern
  const timeSig = { upperNumeral: 4, lowerNumeral: 4, isCompound: () => false };
  const pattern = genMidiPattern(timeSig, false, 2);
  const numDivisions = pattern.evtsArrs.length;
  const divisionMs = measureDurMs / numDivisions;

  let idx = 0;
  drumIntervalId = setInterval(() => {
    const notes = pattern.evtsArrs[idx % numDivisions];
    notes.forEach(note => {
      MIDI.noteOn(2, note.noteNum, note.velocity);
    });
    idx++;
  }, divisionMs);
}

function handleMeasureTiming(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum >= 60) return;

  const biggestNoteNum = lowNoteList.length > 0
    ? Math.max(...lowNoteList.map(n => n.noteNum))
    : -Infinity;

  if (evt.noteNum < biggestNoteNum && lowNoteList.length > 0) {
    const measureDurMs = evt.time - lowNoteList[0].time;

    // m1c: trigger 4-beat drum track at the detected tempo
    playDrumPattern(measureDurMs);

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
