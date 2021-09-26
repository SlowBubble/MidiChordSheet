
import * as math from './math.js';

export function fromJson(json) {
  if (!json) {
    return null;
  }
  return new Spelling(
    json.letter,
    json.numSharps,
    json.hasNatural);
}

function getNoteNumToNoAccidSpelling(){
  return {
    0: new Spelling('C'),
    2: new Spelling('D'),
    4: new Spelling('E'),
    5: new Spelling('F'),
    7: new Spelling('G'),
    9: new Spelling('A'),
    11: new Spelling('B'),
  };
}

function fromNoteNumWithLetter(num, letter) {
  const numModOctave = math.mod(num, 12);
  for (let numSharps = 0; numSharps <= 2; numSharps++) {
    const try1 = new Spelling(letter, numSharps);
    if (math.mod(try1.toNoteNum(), 12) == numModOctave) {
      return try1;
    }
    const try2 = new Spelling(letter, -numSharps);
    if (math.mod(try2.toNoteNum(), 12) == numModOctave) {
      return try2;
    }
  }
  console.warn(
    'Unable to find spelling with les than 3 accidentals from note number for letter.',
    num, letter);
  return fromNoteNum(num);
}

function fromNoteNumWithMapping(num, mapping) {
  const numModOctave = math.mod(num, 12);
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
  math.range(0, 12).forEach(idx => {
    const nextLetter = mappingInC[idx].letter;
    letterRaises.push(nextLetter !== currLetter);
    currLetter = nextLetter;
  });
  const finalMapping = {};
  let currSpelling = chord.root;
  math.range(0, 12).forEach(idx => {
    let letterToUse = currSpelling.letter;
    if (letterRaises[idx]) {
      letterToUse = getNextLetter(currSpelling.letter);
    }
    const currNoteNum = math.mod(chord.root.toNoteNum() + idx, 12);
    currSpelling = fromNoteNumWithLetter(currNoteNum, letterToUse)
    finalMapping[currNoteNum] = currSpelling;
  });
  return finalMapping;
}

function getStandardMappingInC() {
  const mappingInC = {
    1: new Spelling('D', -1),
    3: new Spelling('E', -1),
    6: new Spelling('F', 1),
    8: new Spelling('A', -1),
    10: new Spelling('B', -1),
  };
  return Object.assign(mappingInC, getNoteNumToNoAccidSpelling())
}

function getDiminishedMappingInC() {
  return {
    0: new Spelling('C'),
    1: new Spelling('D', -1),
    2: new Spelling('D'),
    3: new Spelling('E', -1),
    4: new Spelling('F', - 1),
    5: new Spelling('F'),
    6: new Spelling('G', -1),
    7: new Spelling('G'),
    8: new Spelling('A', -1),
    9: new Spelling('B', -2),
    10: new Spelling('B', -1),
    11: new Spelling('C', -1),
  }
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
    mappingInC[8] = new Spelling('G', 1)
  }
  const finalMapping = translateMapping(mappingInC, chord);
  return fromNoteNumWithMapping(num, finalMapping);
}

export function fromNoteNum(num) {
  let mapping = {
    1: new Spelling('C', 1),
    3: new Spelling('E', -1),
    6: new Spelling('F', 1),
    8: new Spelling('A', -1),
    10: new Spelling('B', -1),
  };
  mapping = Object.assign(mapping, getNoteNumToNoAccidSpelling());

  return fromNoteNumWithMapping(num, mapping);
}
export function fromNoteNumWithFlat(num) {
  let mapping = {
    1: new Spelling('D', -1),
    3: new Spelling('E', -1),
    6: new Spelling('G', -1),
    8: new Spelling('A', -1),
    10: new Spelling('B', -1),
  };
  mapping = Object.assign(mapping, getNoteNumToNoAccidSpelling());

  return fromNoteNumWithMapping(num, mapping);
}

export function fromNoteNumWithSharp(num) {
  let mapping = {
    1: new Spelling('C', 1),
    3: new Spelling('D', 1),
    6: new Spelling('F', 1),
    8: new Spelling('G', 1),
    10: new Spelling('A', 1),
  };
  mapping = Object.assign(mapping, getNoteNumToNoAccidSpelling());

  return fromNoteNumWithMapping(num, mapping);
}

export function nextFifth(spelling) {
  return {
    C: 'G',
    G: 'D',
    D: 'A',
    A: 'E',
  }[spelling.toString()];

}

export class Spelling {
  constructor(letter, numSharps, hasNatural) {
    this.letter = letter || 'C';
    this.letter = this.letter.toUpperCase();
    this.numSharps = numSharps || 0;
    this.hasNatural = hasNatural || false;
  }

  equals(sp2) {
    return (
      this.letter === sp2.letter
      && this.numSharps === sp2.numSharps
      && this.hasNatural === sp2.hasNatural
    );
  }

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

  shift(key1, key2) {
    const noteNumShift = math.mod(key2.toNoteNum() - key1.toNoteNum(), 12);
    const charShift = key2.minus(key1);
    let newLetter = this.letter;
    math.range(0, charShift).forEach(_ => {
      newLetter = getNextLetter(newLetter);
    });
    return fromNoteNumWithLetter(this.toNoteNum() + noteNumShift, newLetter);
  }
  minus(sp2) {
    return math.mod(_ascii(this.letter) - _ascii(sp2.letter), numLetters);
  }
}

function _ascii(a) { return a.charCodeAt(0); }

const numLetters = 7;

const letterToBaseNoteNum = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}