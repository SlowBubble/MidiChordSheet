import * as spell from './spell.js';
import * as math from './math.js';

export function fromJson(json) {
  return new Chord(
    json.bass ? spell.fromJson(json.bass) : null,
    spell.fromJson(json.root),
    json.quality,
    json.suspension,
    json.extension,
    json.alterations,
  );
}

export class Chord {
  constructor(bass, root, quality, suspension, extension, alterations) {
    this.bass = bass;
    this.root = root;
    this.quality = quality;
    this.suspension = suspension;
    this.extension = extension;
    this.alterations = alterations;
    this._altMap = {};
    alterations.forEach(item => {
      this._altMap[item.extension] = item.isSharp;
    });
  }

  toString() {
    const quality = this.quality ? this.quality : '';
    const ext = this.extension ? this.extension : '';
    const sus = this.suspension ? 'sus' + this.suspension : '';
    const alt = this.alterations.map(item => {
      return `${item.isSharp ? '#' : 'b'}${item.extension}`
    }).join('');
    const bass = this.bass ? '/' + this.bass : '';
    console.log(ext);
    return `${this.root}${quality}${ext}${sus}${alt}${bass}`;
  }

  getBassSpelling() {
    return this.bass ? this.bass : this.root;
  }

  // Excluding non-root bass and higher alterations.
  // TODO include extension and b5, #5 alterations
  getChordTones() {
    const intervalNums = [];
    const rootNum = this.root.toNoteNum();
    intervalNums.push(math.mod(rootNum, 12));
    const thirdIncr = this.getThirdInterval();
    intervalNums.push(math.mod(rootNum + thirdIncr, 12));
    intervalNums.push(math.mod(rootNum + this.getFifthInterval(), 12));
    intervalNums.sort(function(a, b){return a-b});
    return intervalNums;
  }

  getJazzChordTones() {
    const intervalNums = [];
    const rootNum = this.root.toNoteNum();
    intervalNums.push(math.mod(rootNum + this.getThirdInterval(), 12));
    intervalNums.push(math.mod(rootNum + this.getSeventhInterval(), 12));
    return intervalNums;
  }

  // Include higher alterations and bass note
  getColorTones() {
    const intervalNums = [];
    const rootNum = this.root.toNoteNum();
    if (this.isMinor()) {
      intervalNums.push(math.mod(rootNum + this.getEleventhInterval(), 12));
    } else {
      intervalNums.push(math.mod(rootNum + this.getThirteenthInterval(), 12));
    }
    if (this.extension) {
      intervalNums.push(math.mod(rootNum + this.getSeventhInterval(), 12));
    }
    // TODO add more for dominant.
    intervalNums.push(math.mod(rootNum + this.getNinthInterval(), 12));
    return intervalNums;
    // return intervalNums.filter(num => {
    //   return this.isScaleTone(num);
    // });
  }

  // Use C-ionian scale if unspecified.
  isScaleTone(num, scale) {
    return [
      0,
      2,
      4,
      5,
      7,
      9,
      11].indexOf(num) >= 0;
  }

  isMajor() {
    return this.getThirdInterval() == 4 && this.getSeventhInterval() == 11;
  }
  isDominant() {
    return this.getThirdInterval() == 4 && this.getSeventhInterval() == 10;
  }
  // Both m7 and mM7
  isMinor() {
    return this.getThirdInterval() == 3 && this.getFifthInterval() == 7;
  }
  // Both half- and full-diminished
  isDiminished() {
    return this.getThirdInterval() == 3 && this.getFifthInterval() == 6;
  }
  isAugmented() {
    return this.getThirdInterval() == 4 && this.getFifthInterval() == 8;
  }

  getAlteredAmount(extension) {
    const val = this._altMap[extension];
    if (val === false) {
      return -1;
    }
    if (val === true) {
      return 1;
    }
    return 0;
  }

  // Low level computations of the interval.
  getThirdInterval() {
    if (this.suspension == 2) {
      return 2;
    }
    if (this.suspension == 4) {
      return 5;
    }
    if (this.quality == 'dim' || this.quality == 'm' || this.quality == 'mM') {
      return 3;
    }
    return 4;
  }
  getFifthInterval() {
    if (this.quality == 'dim') {
      return 6;
    }
    if (this.quality == 'aug') {
      return 8;
    }
    return 7 + this.getAlteredAmount(5);
  }
  getSeventhInterval() {
    if (this.quality == 'dim') {
      return 9;
    }
    if (this.quality == 'maj' || !this.quality || this.quality == 'mM') {
      return 11;
    }
    return 10;
  }
  getNinthInterval() {
    return 2 + this.getAlteredAmount(9);
  }
  getEleventhInterval() {
    return 5 + this.getAlteredAmount(11);
  }
  getThirteenthInterval() {
    return 8 + this.getAlteredAmount(13);
  }

  // below or equal
  chordTonesBelow(noteNum) {
    const tones = this.getChordTones();
    return _chordTonesBelow(noteNum, tones);
  }

  jazzChordTonesBelow(noteNum) {
    const tones = this.getJazzChordTones();
    return _chordTonesBelow(noteNum, tones);
  }

  // above or equal
  chordTonesAbove(noteNum) {
    const tones = this.getChordTones();
    const intervalsAboveNoteNum = tones.map(toneNum => {
      return math.mod(toneNum - noteNum, 12);
    });
    // Hack to get a fourth note for the chord tones.
    intervalsAboveNoteNum.sort(ascending);
    intervalsAboveNoteNum.push(intervalsAboveNoteNum[0] + 12);

    return intervalsAboveNoteNum.map(above => {
      return noteNum + above;
    });
  }

  suspend(noteNum, distance) {
    const tones = this.getColorTones();
    const intervalsAboveNoteNum = tones.map(toneNum => {
      return math.mod(toneNum - noteNum, 12);
    });
    intervalsAboveNoteNum.sort(ascending);
    const intervalsBelowNoteNum = tones.map(toneNum => {
      return math.mod(noteNum - toneNum, 12);
    });
    intervalsBelowNoteNum.sort(ascending);
    return intervalsAboveNoteNum.filter(i => {
      return i <= distance && i > 0;
    }).map(above => {
      return noteNum + above;
    }).concat(intervalsBelowNoteNum.filter(i => {
      return i <= distance && i > 0;
    }).map(below => {
      return noteNum - below;
    }));
  }
}

function ascending(a, b){return a-b}

// below or equal
function _chordTonesBelow(noteNum, tones) {
  const intervalsBelowNoteNum = tones.map(toneNum => {
    return math.mod(noteNum - toneNum, 12);
  });
  // Hack to get a fourth note for the chord tones.
  intervalsBelowNoteNum.sort(ascending);
  intervalsBelowNoteNum.push(intervalsBelowNoteNum[0] + 12);

  return intervalsBelowNoteNum.map(below => {
    return noteNum - below;
  });
}