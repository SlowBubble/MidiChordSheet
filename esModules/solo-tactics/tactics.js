import { ChangesOverTime } from "../song-sheet/changesOverTime.js";
import { intervals } from "../chord/interval.js";
import { fromNoteNumWithChord } from "../chord/spell.js";

const Scales = {
  chord_tones: 'Arppeg.',
  pentatonic: 'penta.',
  minor_pentatonic: 'min. penta.',
  major: 'major',
  lydian: 'lydian',
  minor: 'minor', // natural
  dorian: 'dorian',
  diminished: 'dim. scale',
  half_diminished: 'half dim. scale',
  diatonic: 'Diatonic', // Catch-all to describe the church mode scales.
};

export class Tactic {
  constructor({scale, root, addChromaticism = false}) {
    this.scale = scale;
    this.root = root;
    this.addChromaticism = addChromaticism;
  }

  toString() {
    if (this.scale === Scales.chord_tones || this.scale === Scales.diatonic) {
      return this.scale;
    }
    return `${this.root} ${this.scale}`;

  }
}

export class TacticChanges extends ChangesOverTime {
  _deserialize(tactic) {
    return new Tactic(tactic);
  }
  _equal(a, b) {
    return a.toString === b.toString();
  }
}

function makeTactic(scale, root, addChromaticism) {
  return new Tactic({scale: scale, root: root, addChromaticism: addChromaticism});
}

function randomizeRoot(chord, allowedIntervals, pmf) {
  const observation = Math.random();
  let cumProb = 0;
  for (let idx = 0; idx < allowedIntervals.length; idx++) {
    cumProb += pmf[idx];
    if (observation < cumProb) {
      return fromNoteNumWithChord(chord.root.toNoteNum() + allowedIntervals[idx], chord);
    }
  }
  return chord.root;
}

export function toTactic(chord, {level = 0, /*key, prevChord, nextChord*/}) {
  const beyondSimple = Math.random() < 2 * level;
  if (!beyondSimple) {
    return makeTactic(Scales.chord_tones, chord.root);
  }
  if (chord.isMajor()) {
    const usePenta = Math.random() > level;
    if (usePenta) {
      return makeTactic(Scales.pentatonic, randomizeRoot(chord, [intervals.M2, intervals.P5], [0.2, 0.5]));
    }
  }
  if (chord.isMinor()) {
    const usePenta = Math.random() > level;
    if (usePenta) {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [intervals.M2, intervals.P5], [0.2, 0.5]));
    }
  }
  if (chord.isDominant() || chord.isAugmented()){
    if (Math.random() < 0.5) {
      return makeTactic(Scales.pentatonic, randomizeRoot(chord, [intervals.P4, intervals.m7, intervals.tritone], [0.4, 0.4, 0.1]));
    } else {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [intervals.P4, intervals.P5, intervals.m7], [0.3, 0.3, 0.3]));
    }
  }
  if (chord.isHalfDiminished()) {
    const useDim = Math.random() > level;
    if (useDim) {
      return makeTactic(Scales.half_diminished, chord.root);
    }
  } else if (chord.isDiminished()) {
    return makeTactic(Scales.diminished, chord.root);
    // TODO add harmonic minor (e.g. for Bdim7 use C harm. min.)
  }
  return makeTactic(Scales.diatonic, chord.root);
}