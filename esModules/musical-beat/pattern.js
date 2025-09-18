import { Frac, makeFrac } from "../fraction/fraction.js";
import * as math from '../math-util/mathUtil.js';

export class MidiPattern {
  constructor({
    evtsArrs,
    durPerDivision8n,
  }) {
    this.evtsArrs = evtsArrs;
    this.durPerDivision8n = new Frac(durPerDivision8n);
  }
}

export function genMidiPattern(timeSig, isSwinging, numBeatDivisions) {
  const beatInfo = computeBeatInfo(timeSig, numBeatDivisions);
  const strongBeats = genStrongBeats(beatInfo.numBeats);
  const evtsArrs = genNoteOnEvtsArrs({
    strongBeats: strongBeats, numBeatDivisions: beatInfo.numBeatDivisions,
    isSwinging: beatInfo.numBeatDivisions > 2 ? false : isSwinging,
  });
  return new MidiPattern({
    evtsArrs: evtsArrs,
    durPerDivision8n: beatInfo.durPerDivision8n,
  });
}

export function computeBeatInfo(timeSig, numBeatDivisions) {
  const {upperNumeral, lowerNumeral} = timeSig;
  const periodDur8n = makeFrac(upperNumeral * 8, lowerNumeral);
  let numBeats = timeSig.isCompound() ? upperNumeral / 3 : upperNumeral;
  numBeatDivisions = numBeatDivisions || (timeSig.isCompound() ? 3 : 2);
  return {
    numBeats: numBeats,
    numBeatDivisions: numBeatDivisions,
    durPerDivision8n: periodDur8n.over(numBeats * numBeatDivisions),
    durPerBeat8n: periodDur8n.over(numBeats),
    period8n: periodDur8n,
  };
}

function genStrongBeats(numBeats) {
  const strongBeats = []
  for (let idx = 0; idx < numBeats; idx++) {
    if (idx == 0) {
      strongBeats.push([{noteNum: 35, velocity: 120}, {noteNum: 36, velocity: 120}, {noteNum: 42, velocity: 90}]);
      continue;
    }
    if (idx == numBeats - 1) {
      strongBeats.push([{noteNum: 37, velocity: 90}, {noteNum: 42, velocity: 60}]);
      continue;
    }
    if (math.mod(idx, 2) == 0) {
      strongBeats.push([{noteNum: 36, velocity: 50}, {noteNum: 42, velocity: 50}]);
      continue;
    }
    strongBeats.push([{noteNum: 54, velocity: 30}, {noteNum: 44, velocity: 80}]);
  }
  strongBeats.forEach(strongBeat => strongBeat.forEach(evt => evt.isStrongBeat = true));
  return strongBeats;
}

function genNoteOnEvtsArrs({strongBeats, numBeatDivisions, isSwinging}) {
  const skipDrumOnStrongerBeat = strongBeats.length % 2 === 0 && isSwinging;
  return strongBeats.flatMap((strongBeat, idx) => {
    const res = [strongBeat];
    for (let i = 0; i < numBeatDivisions - 2; i++) {
      res.push([{noteNum: 42, velocity: 30}]);
    }
    if (idx < strongBeats.length - 1) {
      if (skipDrumOnStrongerBeat && idx % 2 === 0) {
        res.push([]);
      } else {
        res.push([{noteNum: 42, velocity: 10}]);
      }
    } else {
      res.push([{noteNum: 38, velocity: 10}, {noteNum: 42, velocity: 30}]);
    }
    return res;
  });
}