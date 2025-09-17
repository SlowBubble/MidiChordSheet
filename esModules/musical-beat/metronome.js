import { NoteOnEvt } from "../midi-data/midiEvent.js";
import * as math from '../math-util/mathUtil.js';

export class Metronome {
  constructor(musicalSound, metronomeBeatPub) {
    this._started = false;
    this._musicalSound = musicalSound;
    this._metronomeBeatPub = metronomeBeatPub;
    this._interval = null;
    this._bpm = 70;
    this._pattern = genMellowPattern({numBeats: 4, numSubBeats: 2});
    this._currPatternIdx = 0;
  }
  setTempo(bpm) {
    if (bpm > 0) {
      this._bpm = bpm;
    }
  }
  pauseOrResume() {
    if (this._started) {
      this.pause();
    } else {
      this.resume();
    }
  }
  pause() {
    window.clearInterval(this._interval);
    this._started = false;
    this._currPatternIdx = 0;
  }

  resume() {
    this.pause();
    this._interval = window.setInterval(_ => {
      const seq = this._pattern.notesSeq;
      seq[this._currPatternIdx].forEach(note => {
        this._musicalSound.execute(new NoteOnEvt({
          noteNum: note.noteNum, velocity: note.velocity * 2, channelNum: 10
        }));
      });
      if (math.mod(this._currPatternIdx, this._pattern.numSubBeats) == 0) {
        if (this._metronomeBeatPub) {
          this._metronomeBeatPub(new MetronomeBeat({
            time: Date.now(),
            idx: this._currPatternIdx / this._pattern.numSubBeats,
          }));
        }
      }
      this._currPatternIdx = math.mod(this._currPatternIdx + 1, seq.length);
    }, 60 * 1000 / this._bpm / this._pattern.numSubBeats);
    this._started = true;
  }
}

export class MetronomeBeat {
  constructor({time, idx, time8n, isPickup}) {
    this.time = time;
    this.idx = idx;
    this.time8n = time8n;
    this.isPickup = isPickup;
  }
}
export class Pattern {
  constructor({numSubBeats: numSubBeats, notesSeq: notesSeq}) {
    this.numSubBeats = numSubBeats;
    this.notesSeq = notesSeq;
  }
}

export function genMellowPattern({numBeats, numSubBeats}) {
  const strongBeats = genStrongBeats(numBeats);
  return new Pattern({
    numSubBeats: numSubBeats,
    notesSeq: genNotesSeq({
      strongBeats: strongBeats, numSubBeats: numSubBeats
    }),
  });
}

function genMellowSwingPattern(numBeats) {
  const strongBeats = genStrongBeats(numBeats);
  return new Pattern({
    numSubBeats: 3,
    notesSeq: genSwingNotesSeq(strongBeats),
  });
}

function genStrongBeats(numBeats) {
  const strongBeats = []
  for (let idx = 0; idx < numBeats; idx++) {
    if (idx == 0) {
      strongBeats.push([{noteNum: 35, velocity: 110}, {noteNum: 42, velocity: 80}]);
      continue;
    }
    if (idx == numBeats - 1) {
      strongBeats.push([{noteNum: 37, velocity: 60}, {noteNum: 42, velocity: 30}]);
      continue;
    }
    if (math.mod(idx, 2) == 0) {
      strongBeats.push([{noteNum: 36, velocity: 30}, {noteNum: 42, velocity: 30}]);
      continue;
    }
    strongBeats.push([{noteNum: 36, velocity: 30}, {noteNum: 44, velocity: 60}]);
  }
  return strongBeats;
}

function genSwingNotesSeq(strongBeats) {
  return strongBeats.flatMap((strongBeat, idx) => {
    if (idx < strongBeats.length - 1) {
      return [
        strongBeat,
        [],
        [{noteNum: 42, velocity: 20}]
      ];
    }
    return [
      strongBeat,
      [{noteNum: 42, velocity: 20}],
      [{noteNum: 38, velocity: 15}, {noteNum: 42, velocity: 30}],
    ]
  });
}

function genNotesSeq({strongBeats, numSubBeats}) {
  return strongBeats.flatMap((strongBeat, idx) => {
    const res = [strongBeat];
    for (let i = 0; i < numSubBeats - 2; i++) {
      res.push([{noteNum: 42, velocity: 30}])
    }
    if (idx < strongBeats.length - 1) {
      res.push([{noteNum: 42, velocity: 30}])
    } else {
      res.push([{noteNum: 38, velocity: 10}, {noteNum: 42, velocity: 30}]);
    }
    return res;
  });
}


function generate4_4Swing() {
  return genMellowSwingPattern(3);
}