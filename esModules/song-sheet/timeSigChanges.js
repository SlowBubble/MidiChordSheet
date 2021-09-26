import { makeFrac } from "../fraction/fraction.js";
import { ChangesOverTime } from "./changesOverTime.js";

export class TimeSig {
  constructor({
    upperNumeral = 4,
    lowerNumeral = 4,
  }) {
    this.upperNumeral = upperNumeral;
    this.lowerNumeral = lowerNumeral;
  }
  equals(other) {
    return (
      this.upperNumeral == other.upperNumeral &&
      this.lowerNumeral == other.lowerNumeral);
  }
  isCompound() {
    return this.upperNumeral >= 6 && this.upperNumeral % 3 === 0;
  }
  toString() {
    return `${this.upperNumeral} ${this.lowerNumeral}`;
  }
  getDurPerMeasure8n() {
    return makeFrac(8 * this.upperNumeral, this.lowerNumeral);
  }
}


export class TimeSigChanges extends ChangesOverTime {
  constructor({
    defaultVal = {},
    ...rest
  }) {
    super({defaultVal: defaultVal, ...rest});
  }

  _deserialize(val) {
    return new TimeSig(val);
  }
  _equal(a, b) {
    return a.equals(b);
  }
}