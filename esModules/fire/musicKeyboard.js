
// TODO make it easy to generate an ordered list of evt.code.
import * as crooked from './crooked.js';
import * as oneTwoThree from './oneTwoThree.js';
import * as trumpet from './trumpet.js';

export class DebounceFilter {
  constructor(stateMgr, keydownPub, keyupPub) {
    let downKeys = {};

    document.addEventListener('keydown', evt => {
      if (stateMgr.isChordMode()) {
        return;
      }
      if (downKeys.hasOwnProperty(evt.code)) {
        return;
      }
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
      }
      const now = Date.now();
      keydownPub(evt, now);

      downKeys[evt.code] = now;
    });

    document.addEventListener('keyup', evt => {
      // const downDate = downKeys[evt.code];
      delete downKeys[evt.code];
      keyupPub(evt, Date.now());
    });

    window.addEventListener('blur', evt => {
      downKeys = {};
    });
  }
}

export class NoteDownFilter {
  constructor(debouncedKeydownEvtSub, notedownPub, stateMgr, keyupSub, noteupPub, noteGpsMgr,
      valveDownPub, valveUpPub, hasMidiInputsFunc) {
    function toNoteNum(key, keyup) {
      if (key === `Enter`) {
        if (keyup) {
          return noteGpsMgr.getCurrNoteNumsAndIncr();
        }
        return noteGpsMgr.getCurrNoteNums();
      }

      const relNoteNum = crooked.keyToNoteNum[key];
      if (relNoteNum === undefined) {
        return [];
      }
      const bassShift = stateMgr.getCurrVoice().clef === 'bass' ? -24 : 0;
      return [relNoteNum + bassShift + stateMgr.getNoteNumShift()];
    }

    debouncedKeydownEvtSub((evt, time) => {
      if (hasMidiInputsFunc()) {
        return;
      }
      if (stateMgr.isTrumpet) {
        const res = trumpet.keyMapping[evt.key];
        if (res) {
          valveDownPub(res);
        }
        return;
      }
      const noteNums = toNoteNum(evt.key);
      if (noteNums.length) {
        notedownPub(noteNums, time);
      }
    });
    keyupSub((evt, time) => {
      if (hasMidiInputsFunc()) {
        return;
      }
      if (stateMgr.isTrumpet) {
        const res = trumpet.keyMapping[evt.key];
        if (res) {
          valveUpPub(res);
        }
        return;
      }
      const noteNum = toNoteNum(evt.key, true);
      if (noteNum) {
        noteupPub(noteNum, time);
      }
    });
  }
}

// Publish possible beats as beat event.
export class PossBeatFilter {
  constructor(debouncedKeydownEvtSub, possBeatPub, disablePub, hasMidiInputsFunc) {
    debouncedKeydownEvtSub((evt, time) => {
      if (hasMidiInputsFunc()) {
        if (evt.key == ' ') {
          evt.preventDefault();
          possBeatPub(time);
          return;
        }
      }
      if (
          evt.key !== 'Tab' &&
          evt.key !== '\\' &&
          evt.key !== 'Escape') {
        return;
      }
      evt.preventDefault();
      if (evt.key == 'Escape') {
        disablePub(time);
      } else {
        possBeatPub(time);
      }
    });
  }
}

// Interpret when to enable/disable beat mode:
// 1. Enable after 1 quick shift key down-up.
// 2. Disable if escape key is hit.
// 3. Disable after 3 seconds of no beat event.
const beatThreshold = 3000;
export class BeatFilter {
  constructor(disablePub, disableSub, possBeatSub, beatPub, beatModePub, ebanner, renderPub, execPub) {
    this.enabled = false;
    this._disableId = null;
    this.beatModePub = beatModePub;
    this.disablePub = disablePub;
    this.ebanner = ebanner;

    // 1.
    possBeatSub(start => {
      this.extendEnable();
      beatPub(start);
    });

    disableSub(time => {
      this.disable(time);
      // Add changes to undoStorage.
      execPub();

      // This is for mobile, which doesn't render until disabled.
      if (renderPub) {
        renderPub();
      }
    });
  }

  disable(time) {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    window.clearTimeout(this._disableId);
    this.ebanner.display('Static mode');
    this.beatModePub(false, time);
  }

  extendEnable() {
    this.enabled = true;
    this.beatModePub(true);
    this.ebanner.display('Beat mode', 'limegreen');
    // 3.
    window.clearTimeout(this._disableId);
    this._disableId = window.setTimeout(() => {
      this.disablePub();
    }, beatThreshold);
  }

}
