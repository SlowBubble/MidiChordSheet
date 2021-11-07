import * as crooked from './crooked.js';
import * as bendLeft from './bendLeft.js';
import * as bendRight from './bendRight.js';
import * as midiEvent from '../midi-data/midiEvent.js';
import * as pubSub from '../pub-sub/pubSub.js';

export function setupKeyboard(midiEvtWithSoundPub, handBeatPub) {
  const [keyDownPub, keyDownSub] = pubSub.make();
  const [keyUpPub, keyUpSub] = pubSub.make();
  new KeyToDebouncedKeyFilter(keyDownPub, keyUpPub);
  new KeyToMidiEvtFilter(keyDownSub, keyUpSub, midiEvtWithSoundPub);
  keyDownSub((evt, now) => {
    if (evt.key !== 'Tab' && evt.key !== '\\') {
      return;
    }
    if (handBeatPub) {
      handBeatPub({timeMs: now});
    }
  })
}

class KeyToDebouncedKeyFilter {
  constructor(keyDownPub, keyUpPub) {
    let downKeys = {};

    document.addEventListener('keydown', evt => {
      if (downKeys.hasOwnProperty(evt.code)) {
        return;
      }
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
      }
      evt.preventDefault();
      const now = Date.now();
      keyDownPub(evt, now);

      downKeys[evt.code] = now;
    });

    document.addEventListener('keyup', evt => {
      delete downKeys[evt.code];
      keyUpPub(evt, Date.now());
    });

    window.addEventListener('blur', evt => {
      downKeys = {};
    });
  }
}

class KeyToMidiEvtFilter {
  constructor(keyDownSub, keyUpSub, midiEvtWithSoundPub) {
    const defaultChannelNum = 0;
    const defaultVelocity = 90;
    function toNoteNum(key) {
      return crooked.keyToNoteNum[key];
    }

    keyDownSub((evt, time) => {
      const noteNum = toNoteNum(evt.key);
      if (!noteNum) {
        return;
      }
      midiEvtWithSoundPub(new midiEvent.NoteOnEvt({
        noteNum: noteNum, velocity: defaultVelocity, channelNum: defaultChannelNum, time: time,
      }));
    });
    keyUpSub((evt, time) => {
      const noteNum = toNoteNum(evt.key);
      if (!noteNum) {
        return;
      }

      midiEvtWithSoundPub(new midiEvent.NoteOffEvt({
        time: time, noteNum: noteNum, channelNum: defaultChannelNum,
      }));
    });
  }
}