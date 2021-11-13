import { range } from '../array-util/arrayUtil.js';
import { mod } from '../math-util/mathUtil.js';

export const letterToNoteNum = Object.freeze({
  C: 0,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  Gb: 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
})
export function fromNoteNum(num) {
  let mapping = {
    1: makeSpelling('C', 1),
    3: makeSpelling('E', -1),
    6: makeSpelling('F', 1),
    8: makeSpelling('A', -1),
    10: makeSpelling('B', -1),
  };
  mapping = Object.assign(mapping, getNoteNumToNoAccidSpelling());
  return fromNoteNumWithMapping(num, mapping);
}
export function fromNoteNumWithFlat(num) {
  let mapping = {
    1: makeSpelling('D', -1),
    3: makeSpelling('E', -1),
    6: makeSpelling('G', -1),
    8: makeSpelling('A', -1),
    10: makeSpelling('B', -1),
  };
  mapping = Object.assign(mapping, getNoteNumToNoAccidSpelling());

  return fromNoteNumWithMapping(num, mapping);
}

export function fromNoteNumWithSharp(num) {
  let mapping = {
    1: makeSpelling('C', 1),
    3: makeSpelling('D', 1),
    6: makeSpelling('F', 1),
    8: makeSpelling('G', 1),
    10: makeSpelling('A', 1),
  };
  mapping = Object.assign(mapping, getNoteNumToNoAccidSpelling());

  return fromNoteNumWithMapping(num, mapping);
}

export function fromNoteNumWithChord(num, chord) {
  if (!chord) {
    return fromNoteNum(num);
  }

  let mappingInC = getStandardMappingInC();
  if (chord.isDiminished()) {
    mappingInC = getDiminishedMappingInC();
  }
  if (chord.isAugmented()) {
    mappingInC[8] = makeSpelling('G', 1);
  }
  const finalMapping = translateMapping(mappingInC, chord);
  return fromNoteNumWithMapping(num, finalMapping);
}


export function makeSpelling(letter, numSharps, hasNatural) {
  return new Spelling({letter: letter, numSharps: numSharps, hasNatural: hasNatural})
}

export class Spelling {
  constructor({letter = 'C', numSharps = 0, hasNatural = false}) {
    this.letter = letter.toUpperCase();
    this.numSharps = numSharps;
    this.hasNatural = hasNatural;
  }

  equals(sp2) {
    return (
      this.letter === sp2.letter
      && this.numSharps === sp2.numSharps
      && this.hasNatural === sp2.hasNatural
    );
  }

  // TODO move it at an ABC-specific module.
  toAbc(octaveNum) {
    const octaveNumRelC4 = octaveNum - 4;
    return [
      this.numSharps > 0 ? '^'.repeat(this.numSharps) : '',
      this.numSharps < 0 ? '_'.repeat(-this.numSharps) : '',
      this.hasNatural ? '=' : '',
      this.letter.toUpperCase(),
      octaveNumRelC4 > 0 ? "'".repeat(octaveNumRelC4) : '',
      octaveNumRelC4 < 0 ? ",".repeat(-octaveNumRelC4) : '',
    ].join('');
  }

  toNoteNum(octaveNum) {
    octaveNum = octaveNum || 0;
    return octaveNum * 12 + letterToBaseNoteNum[this.letter] + this.numSharps;
  }

  toString() {
    const accidentals = this.numSharps > 0 ? '#'.repeat(this.numSharps) : 'b'.repeat(-this.numSharps);
    return `${this.letter.toUpperCase()}${accidentals}`;
  }

  // Assuming a major scale.
  // TODO do we need another arg to allow for minor scale?
  toRomanNumeralString(baseMajKey) {
    const charShift = _minus(this.letter, baseMajKey.letter);
    const numeral = {
      0: 'I',
      1: 'II',
      2: 'III',
      3: 'IV',
      4: 'V',
      5: 'VI',
      6: 'VII',
    }[charShift];
    const numSharps = this.numSharpsRelMajKey(baseMajKey);
    const prefix = numSharps > 0 ? range(0, numSharps).map(_ => '#').join('') : range(0, -numSharps).map(_ => 'b').join('');
    return `${prefix}${numeral}`
  }

  numSharpsRelMajKey(baseMajKey) {
    const charShift = _minus(this.letter, baseMajKey.letter);
    // Assuming a major scale.
    const noteNumShift = {
      0: 0,
      1: 2,
      2: 4,
      3: 5,
      4: 7,
      5: 9,
      6: 11,
    }[charShift];
    const currNoteNum = baseMajKey.toNoteNum() + noteNumShift;
    const wantNoteNum = this.toNoteNum();
    const numSharps = mod(wantNoteNum - currNoteNum, 12);
    if (numSharps <= 6) {
      return numSharps;
    }
    return numSharps - 12;
  }

  shift(key1, key2, minimizeNumAccidentals) {
    const noteNumShift = mod(key2.toNoteNum() - key1.toNoteNum(), 12);
    const charShift = _minus(key2.letter, key1.letter);
    let newLetter = this.letter;
    range(0, charShift).forEach(_ => {
      newLetter = getNextLetter(newLetter);
    });
    const targetNoteNum = this.toNoteNum() + noteNumShift;
    const possSpelling = fromNoteNumWithLetter(targetNoteNum, newLetter);
    if (minimizeNumAccidentals && possSpelling.toString() === 'Cb') {
      return makeSpelling('B');
    }
    if (minimizeNumAccidentals && possSpelling.toString() === 'Fb') {
      return makeSpelling('E');
    }
    if (minimizeNumAccidentals && possSpelling.toString() === 'B#') {
      return makeSpelling('C');
    }
    if (minimizeNumAccidentals && possSpelling.toString() === 'E#') {
      return makeSpelling('F');
    }
    if (Math.abs(possSpelling.numSharps) < 2) {
      return possSpelling;
    }
    if (possSpelling.numSharps >= 2) {
      return fromNoteNumWithSharp(targetNoteNum);
    }
    return fromNoteNumWithFlat(targetNoteNum);
  }
}

function _minus(letter1, letter2) {
  const numMusicalLetters = 7;
  return mod(_asciiNum(letter1) - _asciiNum(letter2), numMusicalLetters);
}

function _asciiNum(a) {
  return a.charCodeAt(0);
}

const letterToBaseNoteNum = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

function getNoteNumToNoAccidSpelling(){
  return {
    0: makeSpelling('C'),
    2: makeSpelling('D'),
    4: makeSpelling('E'),
    5: makeSpelling('F'),
    7: makeSpelling('G'),
    9: makeSpelling('A'),
    11: makeSpelling('B'),
  };
}

function fromNoteNumWithLetter(num, letter) {
  const numModOctave = mod(num, 12);
  for (let numSharps = 0; numSharps <= 2; numSharps++) {
    const try1 = makeSpelling(letter, numSharps);
    if (mod(try1.toNoteNum(), 12) == numModOctave) {
      return try1;
    }
    const try2 = makeSpelling(letter, -numSharps);
    if (mod(try2.toNoteNum(), 12) == numModOctave) {
      return try2;
    }
  }
  console.warn(
    'Unable to find spelling with les than 3 accidentals from note number for letter.',
    num, letter);
  return fromNoteNum(num);
}

function fromNoteNumWithMapping(num, mapping) {
  const numModOctave = mod(num, 12);
  return mapping[numModOctave];
}

function getNextLetter(letter) {
  return {
    A: 'B',
    B: 'C',
    C: 'D',
    D: 'E',
    E: 'F',
    F: 'G',
    G: 'A',
  }[letter];
}

function translateMapping(mappingInC, chord) {
  let currLetter = 'C';
  const letterRaises = [];
  range(0, 12).forEach(idx => {
    const nextLetter = mappingInC[idx].letter;
    letterRaises.push(nextLetter !== currLetter);
    currLetter = nextLetter;
  });
  const finalMapping = {};
  let currSpelling = chord.root;
  range(0, 12).forEach(idx => {
    let letterToUse = currSpelling.letter;
    if (letterRaises[idx]) {
      letterToUse = getNextLetter(currSpelling.letter);
    }
    const currNoteNum = mod(chord.root.toNoteNum() + idx, 12);
    currSpelling = fromNoteNumWithLetter(currNoteNum, letterToUse)
    finalMapping[currNoteNum] = currSpelling;
  });
  return finalMapping;
}

function getStandardMappingInC() {
  const mappingInC = {
    1: makeSpelling('D', -1),
    3: makeSpelling('E', -1),
    6: makeSpelling('F', 1),
    8: makeSpelling('A', -1),
    10: makeSpelling('B', -1),
  };
  return Object.assign(mappingInC, getNoteNumToNoAccidSpelling())
}

function getDiminishedMappingInC() {
  return {
    0: makeSpelling('C'),
    1: makeSpelling('D', -1),
    2: makeSpelling('D'),
    3: makeSpelling('E', -1),
    4: makeSpelling('F', - 1),
    5: makeSpelling('F'),
    6: makeSpelling('G', -1),
    7: makeSpelling('G'),
    8: makeSpelling('A', -1),
    9: makeSpelling('B', -2),
    10: makeSpelling('B', -1),
    11: makeSpelling('C', -1),
  }
}
