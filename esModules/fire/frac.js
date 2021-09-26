/**
 * @fileoverview Description of this file.
 */

import * as math from './math.js';

export function build(numer, denom) {
  if (isNaN(denom)) {
    denom = 1;
  }
  return new Frac(numer, denom);
}

export function fromJson(json) {
  if (!json) {
    return build(0);
  }
  return new Frac(json.numer, json.denom);
}

export function fromString(str) {
  const [numerStr, denomStr] = str.split('/');
  const numer = parseInt(numerStr);
  const denom = parseInt(denomStr);
  if (isNaN(numer) || isNaN(denom)) {
    throw new Error('Unable to parse this as fraction: ' + str);
  }
  return new Frac(numer, denom);
}

export class Frac {
  constructor(numer, denom) {
    if (isNaN(numer)) {
      throw 'numerator is NaN';
    }
    if (isNaN(denom)) {
      throw 'denominator is NaN';
    }
    if (denom == 0) {
      throw new Error("denominator must be non-zero.");
    }
    // Obtaining a unique rep.
    if (denom < 0) {
      numer = -numer;
      denom = -denom;
    }
    const gcd = math.gcd(numer, denom);
    this.numer = numer / gcd;
    this.denom = denom / gcd;
  }

  getDenom() {
    return this.denom;
  }

  getNumer() {
    return this.numer;
  }

  // TODO remove all static methods
  static plus(f1, f2) {
    return new Frac(f1.numer * f2.denom + f2.numer * f1.denom, f1.denom * f2.denom);
  }
  static minus(f1, f2) {
    return Frac.plus(f1, f2.negative());
  }
  static times(f1, f2) {
    return new Frac(f1.numer * f2.numer, f1.denom * f2.denom);
  }
  static divides(f1, f2) {
    return new Frac(f1.numer * f2.denom, f1.denom * f2.numer);
  }

  isWhole() {
    return this.denom === 1;
  }

  plus(f2) {
    const f1 = this;
    if (typeof f2 === 'number') {
      throw 'Not a fraction';
    }
    return new Frac(f1.numer * f2.denom + f2.numer * f1.denom, f1.denom * f2.denom);
  }

  minus(f2) {
    const f1 = this;
    if (typeof f2 === 'number') {
      throw 'Not a fraction';
    }
    return f1.plus(f2.negative());
  }

  times(f2) {
    const f1 = this;
    if (typeof f2 === 'number') {
      throw 'Not a fraction';
    }
    return new Frac(f1.numer * f2.numer, f1.denom * f2.denom);
  }

  over(f2) {
    const f1 = this;
    if (typeof f2 === 'number') {
      throw 'Not a fraction';
    }
    return new Frac(f1.numer * f2.denom, f1.denom * f2.numer);
  }

  negative() {
    return new Frac(-this.numer, this.denom);
  }

  toString() {
    return `${this.numer}/${this.denom}`;
  }

  toFloat() {
    return this.numer / this.denom;
  }

  equals(frac2) {
    return this.numer === frac2.numer && this.denom === frac2.denom;
  }

  lessThan(frac2) {
    // Assumes that denom is > 0 always.
    return this.numer * frac2.denom < frac2.numer * this.denom;
  }
  leq(frac2) {
    return this.lessThan(frac2) || this.equals(frac2);
  }

  geq(frac2) {
    return !this.lessThan(frac2);
  }

  greaterThan(frac2) {
    return !this.leq(frac2);
  }

  weaklyInside(left, right) {
    return left.leq(this) && this.leq(right);
  }

  strictlyInside(left, right) {
    return left.lessThan(this) && this.lessThan(right);
  }

  fractionalPart() {
    return this.minus(this.wholePart());
  }

  wholePart() {
    return build(Math.floor(this.toFloat()));
  }
}
