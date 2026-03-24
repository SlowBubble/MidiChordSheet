import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';

const [midiEvtPub, midiEvtSub] = pubSub.make();

const volume = 120;
const soundfontUrl = '../lib/midi.js/soundfont/';

// m1b: track low notes (noteNum < 60) to compute measure duration
const lowNoteList = []; // each entry: { noteNum, timeMs }

function handleMeasureTiming(evt) {
  if (evt.type !== midiEvent.midiEvtType.NoteOn) return;
  if (evt.noteNum >= 60) return;

  const biggestNoteNum = lowNoteList.length > 0
    ? Math.max(...lowNoteList.map(n => n.noteNum))
    : -Infinity;

  if (evt.noteNum < biggestNoteNum && lowNoteList.length > 0) {
    const measureDurMs = evt.time - lowNoteList[0].time;
    console.log('measureDurMs:', measureDurMs);
    lowNoteList.length = 0;
  }

  lowNoteList.push({ noteNum: evt.noteNum, time: evt.time });
}

window.onload = () => {
  MIDI.loadPlugin({
    soundfontUrl: soundfontUrl,
    instrument: 'acoustic_grand_piano',
    onsuccess: () => {
      MIDI.setVolume(0, volume);

      midiEvtSub(evt => {
        if (evt.type === midiEvent.midiEvtType.NoteOn) {
          MIDI.noteOn(evt.channelNum, evt.noteNum, evt.velocity);
        } else if (evt.type === midiEvent.midiEvtType.NoteOff) {
          MIDI.noteOff(evt.channelNum, evt.noteNum);
        }
        handleMeasureTiming(evt);
      });
    },
  });
};

setupKeyboard(midiEvtPub);
