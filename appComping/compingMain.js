import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';

const [midiEvtPub, midiEvtSub] = pubSub.make();

const volume = 120;
const soundfontUrl = '../lib/midi.js/soundfont/';

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
      });
    },
  });
};

setupKeyboard(midiEvtPub);
