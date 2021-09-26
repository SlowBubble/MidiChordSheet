import { makeFrac } from "../fraction/fraction.js";

// Approach: start with deterministic algo
// No need to worry about dur > durPerMeasure because we will break the chordLocs up by the bar lines.
// Also, consider merging 2 chord locs, if they add up to 4 beats.

// Returns [Rhythm], i.e.
// [{chordLoc: chordLoc, bassPattern: [Segment], treblePattern: [Segment]}]
export function genRhythms(songPart, strategy) {

}

// DSL used to denote the items within each pattern.
const SegmentType = Object.freeze({
  Rest: 'Rest',
  Bass: 'Bass',
  Shell: 'Shell',
  UpperStructure: 'UpperStructure',
  Note: 'Note',
  Sustain: 'Sustain',
});
const rest = {
  type: SegmentType.Rest,
};
const _ = {
  type: SegmentType.Sustain,
};
const bass = {
  type: SegmentType.Bass,
};
const bass1 = {
  type: SegmentType.Bass,
  variation: 1,
};
const shell = {
  type: SegmentType.Shell,
};
const upper = {
  type: SegmentType.UpperStructure,
};
const note0 = {
  type: SegmentType.Note,
  variation: 0,
};
const note1 = {
  type: SegmentType.Note,
  variation: 1,
};
const note2 = {
  type: SegmentType.Note,
  variation: 2,
};
const note3 = {
  type: SegmentType.Note,
  variation: 3,
};

const bassPatterns = [{
  name: '1_of_k',
  bassPattern: [bass],
}, {
  name: '1_of_k_plus_last_beat',
  bassPattern: [bass],
  // This only work for non-compound meter. Need to use 3 instead of 2 for 6/8 or 9/8.
  addFromRight: {segment: bass, dur8nFromRight: makeFrac(2)},
}, {
  name: '1_of_k_plus_last_up_beat',
  bassPattern: [bass],
  addFromRight: {segment: bass, dur8nFromRight: makeFrac(1)},
}, {
  name: '2_of_4',
  bassPattern: [bass, bass1],
  requiredDur8n: makeFrac(8),
}];

const treblePatterns = [{
  name: '1_of_k',
  treblePattern: [shell],
}, {
  name: '2_of_4',
  treblePattern: [shell, shell],
  requiredDur8n: makeFrac(8),
}, {
  name: 'transition',
  treblePattern: [shell, _, _, _, shell, _, note0, note1],
  requiredDur8n: makeFrac(8),
}, {
  name: 'syncopated_transition',
  treblePattern: [shell, _, _, shell, _, note0, note1, _],
  requiredDur8n: makeFrac(8),
}];

const fullPatterns = [{
  name: '1_of_k',
  bassPatternName: '1_of_k',
  treblePatternName: '1_of_k',
}, {
  name: '2_of_4',
  bassPatternName: '1_of_k',
  treblePatternName: '2_of_4',
  requiredDur8n: makeFrac(8),
}, {
  name: '2_of_4_var1',
  bassPatternName: '1_of_k_plus_last_beat',
  treblePatternName: '2_of_4',
  requiredDur8n: makeFrac(8),
}, {
  name: 'transition',
  bassPatternName: '1_of_k',
  treblePatternName: 'transition',
  requiredDur8n: makeFrac(8),
}, {
  name: 'syncopated_transition',
  bassPatternName: '1_of_k_plus_last_up_beat',
  treblePatternName: 'syncopated_transition',
  requiredDur8n: makeFrac(8),  
}];

// Usage:
// The fallback pattern will be the one without requiredDur8n or
// if unspecified, the simple full pattern for dur8n.

// Order by increasing order of importance.
export const nameToStrategy = {
  basic: [{
    fullPatternName: '2_of_4',
    conditions: {
      requiredDur8n: makeFrac(8),
    },
  }, {
    fullPatternName: '2_of_4_var1',
    conditions: {
      requiredDur8n: makeFrac(8),
      mustBeFollowing: '2_of_4',
    },
  }, {
    name: 'transition',
    fullPatternName: 'transition',
    conditions: {
      requiredDur8n: makeFrac(8),
      isLastChord: true,
      // How do you tell? Dominant, sus, dim or augmented.
      isHalfCadence: true,
    },
  }],
};
