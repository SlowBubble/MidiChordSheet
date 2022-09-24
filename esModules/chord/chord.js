import { Intervals } from './interval.js';
import { Spelling } from './spell.js';
import { mod } from '../math-util/mathUtil.js';

export class Chord {
  constructor({
    bass, root, quality = '', extension,
    suspension, alterations = []}) {
    this.bass = bass ? (bass instanceof Spelling ? bass : new Spelling(bass)) : null;
    if (!root) {
      throw 'root is a required argument.'
    }
    this.root = root instanceof Spelling ? root : new Spelling(root);
    if (this.bass && this.bass.toNoteNum() == this.root.toNoteNum()) {
      this.bass = null;
    }
    // Some external uses require major quality to be a non-empty string, but internally, we use ''.
    quality = quality || '';
    this.quality = quality == 'maj' ? '' : quality;
    this.suspension = suspension;
    this.extension = extension;
    this.alterations = alterations;
    this._altMap = {};
    alterations.forEach(item => {
      this._altMap[item.extensionNum] = item.numSharps;
    });
  }

  toString() {
    return this._toString();
  }
  toPrettyString() {
    const str = this.toString();
    return abbreviate(str);
  }
  toRomanNumeralString(baseKey) {
    const str = this._toString(baseKey);
    return abbreviateRomanNumeral(str);
  }
  _toString(baseKey) {
    const sus = (this.suspension == 4 ? 'sus' : (
      this.suspension == 2 ? 'sus2' : '')
    );
    const alt = this.alterations.map(item => {
      let prefix = item.numSharps > 0 ? '#' : (item.numSharps < 0 ? 'b' : 'add');
      if (item.extensionNum === 6 && this._toStringForExtension() === '') {
        prefix = '';
      }
      return `${prefix}${item.extensionNum}`
    }).join('');
    let bassStr = '';
    if (this.bass) {
      const bass = baseKey ? this.bass.toRomanNumeralString(baseKey) : this.bass.toString();
      bassStr = `/${bass}`;
    }
    let rootStr = this.root.toString();
    if (baseKey) {
      rootStr = this.root.toRomanNumeralString(baseKey);
      if (this.getThirdInterval() == Intervals.m3) {
        rootStr = rootStr.toLowerCase();
      }
    }
    return `${rootStr}${this.quality}${this._toStringForExtension()}${sus}${alt}${bassStr}`;
  }

  isMajor() {
    return this.getThirdInterval() == Intervals.M3 && this.getSeventhInterval() == Intervals.M7;
  }
  isDominant() {
    return this.getThirdInterval() == Intervals.M3 && this.getSeventhInterval() == Intervals.m7;
  }
  isMinor() {
    return this.getThirdInterval() == Intervals.m3 && this.getFifthInterval() == Intervals.P5;
  }
  hasExtension() {
    return this.extension || this.alterations.length;
  }
  // Both half- and full-diminished
  isDiminished() {
    return this.getThirdInterval() == Intervals.m3 && this.getFifthInterval() == Intervals.tritone;
  }
  isAugmented() {
    return this.getThirdInterval() == Intervals.M3 && this.getFifthInterval() == Intervals.m6;
  }
  isHalfDiminished() {
    return this.getThirdInterval() == Intervals.m3 && this.getFifthInterval() == Intervals.tritone && this. getSeventhInterval() == Intervals.m7;
  }

  getThirdInterval() {
    if (this.suspension == 2) {
      return Intervals.M2;
    }
    if (this.suspension == 4) {
      return Intervals.P4;
    }
    if (this.quality == 'dim' || this.quality == 'm') {
      return Intervals.m3;
    }
    return Intervals.M3;
  }
  getFifthInterval() {
    if (this.quality == 'dim') {
      return Intervals.tritone;
    }
    if (this.quality == 'aug') {
      return Intervals.m6;
    }
    return Intervals.P5 + this.getAlteredAmount(5);
  }
  getSeventhInterval() {
    if (this.quality == 'dim') {
      return Intervals.M6;
    }
    if (this.suspension) {
      return Intervals.m7;
    }
    // Major chord without major 7.
    if (!this.quality && !this.extension) {
      return Intervals.M6;
    }
    if (this.extension && this.extension.isMajor7) {
      return Intervals.M7;
    }
    // minor 6th chord
    if (this.quality == 'm' && this._altMap[6] === 0) {
      return Intervals.M6;
    }
    return Intervals.m7;
  }

  getAlteredAmount(extension) {
    return this._altMap[extension] || 0;
  }

  // In order of importance
  getSpecifiedColorNoteNums(includeAll, keySig) {
    const res = new Set();
    const rootNoteNum = this.root.toNoteNum();
    const isBassNoteNum = noteNum => {
      const bassNoteNum = this.bass ? this.bass.toNoteNum() : rootNoteNum;
      return mod(bassNoteNum - noteNum, 12) == 0
    };
    const addToResIfNotBass = noteNum => {
      if (!isBassNoteNum(noteNum)) {
        res.add(mod(noteNum, 12));
      }
    };

    addToResIfNotBass(rootNoteNum + this.getThirdInterval());
  
    if (this.extension) {
      addToResIfNotBass(rootNoteNum + this.getSeventhInterval());
      if (this.extension.extensionNum === 9) {
        addToResIfNotBass(rootNoteNum + Intervals.M2);
      }
      if (this.extension.extensionNum === 11) {
        addToResIfNotBass(rootNoteNum + Intervals.P4);
      }
      if (this.extension.extensionNum === 13) {
        addToResIfNotBass(rootNoteNum + Intervals.M6);
      }
    }
    if (this.quality == 'dim' || this.quality == 'aug') {
      addToResIfNotBass(rootNoteNum + this.getFifthInterval());
    }
    Object.entries(this._altMap).forEach(([extNum, numSharps]) => {
      if (extNum === '5') {
        addToResIfNotBass(rootNoteNum + Intervals.P5 + numSharps);
      }
      if (extNum === '9') {
        addToResIfNotBass(rootNoteNum + Intervals.M2 + numSharps);
      }
      if (extNum === '11') {
        addToResIfNotBass(rootNoteNum + Intervals.P4 + numSharps);
      }
      if (extNum === '6' || extNum === '13') {
        addToResIfNotBass(rootNoteNum + Intervals.M6 + numSharps);
      }
    });
    
    if (includeAll || res.size < 2) {
      addToResIfNotBass(this.root.toNoteNum());
    }

    if (includeAll || res.size < 2) {
      addToResIfNotBass(rootNoteNum + this.getFifthInterval());
    }
    if (includeAll) {
      const isLocrian = this.isHalfDiminished();
      const isPhrygian = keySig && (this.quality === 'm' && mod(this.root.toNoteNum(), keySig.toNoteNum(), 12) == Intervals.M3)
      if (!isLocrian && !isPhrygian) {
        addToResIfNotBass(rootNoteNum + Intervals.M2);
      }
    }
    if (includeAll) {
      if (this.getThirdInterval() == Intervals.m3) {
        addToResIfNotBass(rootNoteNum + Intervals.P4);
      }
    }
    // if (includeAll) {
    //   if (this.getThirdInterval() == intervals.M3 && this.getFifthInterval() != intervals.m6) {
    //     addToResIfNotBass(rootNoteNum + intervals.M6);
    //   }
    // }
    return [...res];
  }

  _toStringForExtension() {
    const ext = this.extension;
    if (!ext) {
      return '';
    }
    if (!ext.isMajor7) {
      return `${ext.extensionNum}`;
    }
    // Use `maj` when possible because is easier to read than `M`.
    return `${this.quality == '' ? 'maj' : 'M'}${ext.extensionNum}`;
  }

  // TODO Avoid mutation by implementing clone.
  // Mutate.
  shift(key1, key2) {
    this.root = this.root.shift(key1, key2, /*minimizeNumAccidentals=*/true);
    if (this.bass) {
      this.bass = this.bass.shift(key1, key2, /*minimizeNumAccidentals=*/true);
    }
  }
}

function abbreviate(str) {
  return str
    .replace('m7b5', 'ø7')
    .replace('dim', '°')
    .replace('maj', 'Δ')
    .replace('M', 'Δ')
    .replace('aug', '+')
    ;
}

// Hacks to make Roman Numeral chord more readable
function abbreviateRomanNumeral(str) {
  return abbreviate(str)
    .replace('m', '-')
    .replace('I7', 'I 7')
    .replace('I9', 'I 9')
    .replace('I1', 'I 1')
    ;
}
