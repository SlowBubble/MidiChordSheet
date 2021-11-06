import { ChangesOverTime } from "../song-sheet/changesOverTime.js";
import { Intervals } from "../chord/interval.js";
import { fromNoteNumWithChord } from "../chord/spell.js";
import { Scales } from "./scale.js";
import { toSolfege } from "../solfege-util/solfege.js";

export class Tactic {
  constructor({scale, root, chord, targetNote, addChromaticism = false}) {
    this.scale = scale;
    this.root = root;
    this.chord = chord;
    this.targetNote = targetNote;
    this.addChromaticism = addChromaticism;
  }

  toString() {
    const scale = capitalizeFirstLetter(this.scale == Scales.chord_tones ? this.scale : `${this.root}${this.scale}`);
    if (!this.targetNote) {
      return scale;
    }
    
    return `${scale} (${toSolfege(this.targetNote.toString())})`
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
      return makeTactic(Scales.pentatonic, randomizeRoot(chord, [Intervals.M2, Intervals.P5], [0.2, 0.5]), chord);
    }
  }
  if (chord.isMinor()) {
    const usePenta = Math.random() > level;
    if (usePenta) {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [Intervals.M2, Intervals.P5], [0.2, 0.5]), chord);
    }
  }
  if (chord.isDominant() || chord.isAugmented()){
    if (Math.random() < 0.5) {
      return makeTactic(Scales.pentatonic, randomizeRoot(chord, [Intervals.P4, Intervals.m7, Intervals.tritone], [0.4, 0.4, 0.1]), chord);
    } else if (Math.random() < 0.8) {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [Intervals.P4, Intervals.m7], [0.4, 0.4]), chord);
    }
  }
  // TODO for Bm7b5 or Bdim, treat it like G7.
  if (chord.isHalfDiminished()) {
    if (Math.random() < 0.8) {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [Intervals.P4, Intervals.m7, Intervals.m2, Intervals.m3, Intervals.tritone], [0.15, 0.15, 0.15, 0.15, 0.15]), chord);
    }
    // return makeTactic(Scales.half_diminished, chord.root, chord);
  } else if (chord.isDiminished()) {
    if (Math.random() < 0.8) {
      return makeTactic(Scales.minor_pentatonic, randomizeRoot(chord, [Intervals.P4, Intervals.m7, Intervals.m2, Intervals.m3, Intervals.tritone], [0.15, 0.15, 0.15, 0.15, 0.15]), chord);
    }
    return makeTactic(Scales.diminished, chord.root, chord);
    // TODO add harmonic minor (e.g. for Bdim7 use C harm. min.)
  }
  return makeTactic(Scales.diatonic, chord.root, chord);
}

function capitalizeFirstLetter(string) {
  return string.replace(/\b\w/g, l => l.toUpperCase());
}