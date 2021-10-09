import { intervals } from './interval.js';
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
    return str
      .replace('m7b5', 'ø7')
      .replace('dim', '°')
      .replace('maj', 'Δ')
      .replace('M', 'Δ')
      .replace('aug', '+')
      // .replace('b', '♭')
      // .replace('#', '♯')
    ;
  }
  toRomanNumeralString(baseKey) {
    return this._toString(baseKey);
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
      if (this.getThirdInterval() == intervals.m3) {
        rootStr = rootStr.toLowerCase();
      }
    }
    return `${rootStr}${this.quality}${this._toStringForExtension()}${sus}${alt}${bassStr}`;
  }

  isMajor() {
    return this.getThirdInterval() == intervals.M3 && this.getSeventhInterval() == intervals.M7;
  }
  isDominant() {
    return this.getThirdInterval() == intervals.M3 && this.getSeventhInterval() == intervals.m7;
  }
  // Both m7 and mM7
  isMinor() {
    return this.getThirdInterval() == intervals.m3 && this.getFifthInterval() == intervals.P5;
  }
  // Both half- and full-diminished
  isDiminished() {
    return this.getThirdInterval() == intervals.m3 && this.getFifthInterval() == intervals.tritone;
  }
  isAugmented() {
    return this.getThirdInterval() == intervals.M3 && this.getFifthInterval() == intervals.m6;
  }
  isHalfDiminished() {
    return this.getThirdInterval() == intervals.m3 && this.getFifthInterval() == intervals.tritone && this. getSeventhInterval() == intervals.m7;
  }

  getThirdInterval() {
    if (this.suspension == 2) {
      return intervals.M2;
    }
    if (this.suspension == 4) {
      return intervals.P4;
    }
    if (this.quality == 'dim' || this.quality == 'm') {
      return intervals.m3;
    }
    return intervals.M3;
  }
  getFifthInterval() {
    if (this.quality == 'dim') {
      return intervals.tritone;
    }
    if (this.quality == 'aug') {
      return intervals.m6;
    }
    return intervals.P5 + this.getAlteredAmount(5);
  }
  getSeventhInterval() {
    if (this.quality == 'dim') {
      return intervals.M6;
    }
    if (this.suspension) {
      return intervals.m7;
    }
    // Major chord without major 7.
    if (!this.quality && !this.extension) {
      return intervals.M6;
    }
    if (this.extension && this.extension.isMajor7) {
      return intervals.M7;
    }
    return intervals.m7;
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
        addToResIfNotBass(rootNoteNum + intervals.M2);
      }
      if (this.extension.extensionNum === 11) {
        addToResIfNotBass(rootNoteNum + intervals.P4);
      }
      if (this.extension.extensionNum === 13) {
        addToResIfNotBass(rootNoteNum + intervals.M6);
      }
    }
    if (this.quality == 'dim' || this.quality == 'aug') {
      addToResIfNotBass(rootNoteNum + this.getFifthInterval());
    }
    Object.entries(this._altMap).forEach(([extNum, numSharps]) => {
      if (extNum === '5') {
        addToResIfNotBass(rootNoteNum + intervals.P5 + numSharps);
      }
      if (extNum === '9') {
        addToResIfNotBass(rootNoteNum + intervals.M2 + numSharps);
      }
      if (extNum === '11') {
        addToResIfNotBass(rootNoteNum + intervals.P4 + numSharps);
      }
      if (extNum === '6' || extNum === '13') {
        addToResIfNotBass(rootNoteNum + intervals.M6 + numSharps);
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
      const isPhrygian = keySig && (this.quality === 'm' && mod(this.root.toNoteNum(), keySig.toNoteNum(), 12) == intervals.M3)
      if (!isLocrian && !isPhrygian) {
        addToResIfNotBass(rootNoteNum + intervals.M2);
      }
    }
    if (includeAll) {
      if (this.getThirdInterval() == intervals.m3) {
        addToResIfNotBass(rootNoteNum + intervals.P4);
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
    this.root = this.root.shift(key1, key2);
    if (this.bass) {
      this.bass = this.bass.shift(key1, key2);
    }
  }
}
