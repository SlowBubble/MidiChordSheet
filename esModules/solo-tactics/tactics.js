import { ChangesOverTime } from "../song-sheet/changesOverTime.js";
import { intervals } from "../chord/interval.js";
import { fromNoteNumWithChord } from "../chord/spell.js";

const Scales = {
  chord_tones: 'arppeg.',
  pentatonic: 'penta.',
  minor_pentatonic: 'min penta.',
  major: 'major',
  lydian: 'lydian',
  minor: 'minor', // natural
  dorian: 'dorian',
  diminished: 'dim. scale',
  half_diminished: 'half dim. scale',
  diatonic: 'diatonic', // Catch-all to describe the church mode scales.
};

export class Tactic {
  constructor({scale, root, chord, targetNote, addChromaticism = false}) {
    this.scale = scale;
    this.root = root;
    this.chord = chord;
    this.targetNote = targetNote;
    this.addChromaticism = addChromaticism;
  }

  toString() {
    const scale = capitalizeFirstLetter(this.root.equals(this.chord.root) ? this.scale : `${this.root} ${this.scale}`);
    if (!this.targetNote) {
      return scale;
    }
    return `${scale} (${this.targetNote})`
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

function makeTactic(scale, root, chord) {
  const targetNote = randomizeRoot(
    chord,
    [chord.getThirdInterval(), chord.getFifthInterval(), chord.getSeventhInterval()],
    [0.45, 0.2, 0.3]);
  return new Tactic({
    scale: scale, root: root, chord: chord, targetNote: targetNote,
  });
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
    return makeTactic(Scales.chord_tones, chord.root, chord);
  }
  if (chord.isMajor()) {
    const usePenta = Math.random() > level;
    if (usePenta) {
      return makeTactic(Scales.pentatonic, randomizeRoot(chord, [intervals.M2, intervals.P5], [0.2, 0.5]), chord);
    }
  }
  if (chord.isMinor()) {
    const usePenta = Math.random() > level;
    if (usePenta) {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [intervals.M2, intervals.P5], [0.2, 0.5]), chord);
    }
  }
  if (chord.isDominant() || chord.isAugmented()){
    if (Math.random() < 0.5) {
      return makeTactic(Scales.pentatonic, randomizeRoot(chord, [intervals.P4, intervals.m7, intervals.tritone], [0.4, 0.4, 0.1]), chord);
    } else {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [intervals.P4, intervals.P5, intervals.m7], [0.3, 0.3, 0.3]), chord);
    }
  }
  if (chord.isHalfDiminished()) {
    const useDim = Math.random() > level;
    if (useDim) {
      return makeTactic(Scales.half_diminished, chord.root, chord);
    }
  } else if (chord.isDiminished()) {
    return makeTactic(Scales.diminished, chord.root, chord);
    // TODO add harmonic minor (e.g. for Bdim7 use C harm. min.)
  }
  return makeTactic(Scales.diatonic, chord.root, chord);
}

function capitalizeFirstLetter(string) {
  return string.replace(/\b\w/g, l => l.toUpperCase());
}