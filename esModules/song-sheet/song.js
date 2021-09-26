import { Voice } from "./voice.js";
import { ChordChanges } from "./chordChanges.js";
import { Frac, makeFrac } from "../fraction/fraction.js";
import { KeySigChanges } from "./keySigChanges.js";
import { TimeSigChanges } from "./timeSigChanges.js";
import { ChangesOverTime } from "./changesOverTime.js";
import { SwingChanges } from "./swingChanges.js";
import { getPrettyDateStr } from "../date-util/pretty.js";

export class Song {
  constructor({
    title = getPrettyDateStr(Date.now()),
    chordChanges = {},
    pickup8n = makeFrac(0),
    voices = [{}],
    keySigChanges = {},
    timeSigChanges = {},
    tempo8nPerMinChanges = {defaultVal: 180},
    swingChanges = {},
  }) {
    this.title = title;
    this.voices = voices.map(voice => new Voice(voice));
    this.pickup8n = new Frac(pickup8n);
    this.chordChanges = new ChordChanges(chordChanges);
    this.keySigChanges = new KeySigChanges(keySigChanges);
    this.timeSigChanges = new TimeSigChanges(timeSigChanges);
    this.tempo8nPerMinChanges = new ChangesOverTime(tempo8nPerMinChanges);
    this.swingChanges = new SwingChanges(swingChanges);
  }

  addVoice(voice, idx) {
    if (idx === undefined) {
      this.voices.push(voice);
      return;
    }
    this.voices.splice(idx, 0, voice);
  }
  getVoice(idx) {
    return this.voices[idx];
  }
  getSoundingVoices() {
    return this.voices.filter(voice => voice.settings.volumePercent != 0)
  }
  getVisibleVoices() {
    return this.voices.filter(voice => !voice.settings.hide)
  }
  getStart8n() {
    return this.pickup8n;
  }
  getEnd8n() {
    return this.voices.reduce((accum, voice) => {
      if (voice.noteGps.length == 0) {
        return accum;
      }
      const end8n = voice.noteGps[voice.noteGps.length - 1].end8n
      return end8n.leq(accum) ? accum : end8n;
    }, this.getStart8n());
  }
  // [Frac].
  _getBarsInTime8n() {
    const res = [];
    let currTime8n = makeFrac(0);
    let currBarDur8n = this.timeSigChanges.defaultVal.getDurPerMeasure8n();
    const end8n = this.getStart8n();
    while (currTime8n.lessThan(end8n)) {
      res.push(currTime8n);
      currTime8n = currTime8n.plus(currBarDur8n);
    }
    res.push(end8n);
    return res;
  }
  getChordChangesAcrossBars() {

  }
}

function msPer8nToBpm(msPer8n, num8nPerBeat) {
  return 60000 / (msPer8n * num8nPerBeat);
}
// function bpmToSecPer8n(bpm, num8nPerBeat) {
//   const bps = bpm / 60;
//   const num8nPerSec = bps * num8nPerBeat;
//   return 1 / num8nPerSec;
// }