/**
 * @fileoverview Description of this file.
 */

import * as math from '../math-util/mathUtil.js';

export function makeFrac(numer, denom) {
  if (isNaN(denom)) {
    denom = 1;
  }
  return new Frac({numer: numer, denom: denom});
}

export function fromString(str) {
  const [numerStr, denomStr] = str.split('/');
  const numer = parseInt(numerStr);
  const denom = parseInt(denomStr);
  if (isNaN(numer) || isNaN(denom)) {
    throw new Error('Unable to parse this as fraction: ' + str);
  }
  return makeFrac(numer, denom);
}

export class Frac {
  constructor({numer = 0, denom = 1}) {
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

  isWhole() {
    return this.denom === 1;
  }

  plus(f2) {
    const f1 = this;
    f2 = typeof f2 === 'number' ? makeFrac(f2) : f2;
    return new Frac({
      numer: f1.numer * f2.denom + f2.numer * f1.denom,
      denom: f1.denom * f2.denom,
    });
  }

  minus(f2) {
    const f1 = this;
    f2 = typeof f2 === 'number' ? makeFrac(f2) : f2;
    return f1.plus(f2.negative());
  }

  times(f2) {
    const f1 = this;
    f2 = typeof f2 === 'number' ? makeFrac(f2) : f2;
    return new Frac({
      numer: f1.numer * f2.numer,
      denom: f1.denom * f2.denom,
    });
  }

  over(f2) {
    const f1 = this;
    f2 = typeof f2 === 'number' ? makeFrac(f2) : f2;
    return new Frac({
      numer: f1.numer * f2.denom,
      denom: f1.denom * f2.numer,
    });
  }

  negative() {
    return new Frac({
      numer: -this.numer,
      denom: this.denom,
    });
  }

  toString() {
    return `${this.numer}/${this.denom}`;
  }

  toFloat() {
    return this.numer / this.denom;
  }

  equals(frac2) {
    frac2 = typeof frac2 === 'number' ? makeFrac(frac2) : frac2;
    return this.numer === frac2.numer && this.denom === frac2.denom;
  }

  lessThan(frac2) {
    // Assumes that denom is > 0 always.
    frac2 = typeof frac2 === 'number' ? makeFrac(frac2) : frac2;
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