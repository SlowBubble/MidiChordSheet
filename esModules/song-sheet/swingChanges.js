
import { Frac, makeFrac } from "../fraction/fraction.js";
import { ChangesOverTime } from "./changesOverTime.js";

export class Swing {
  constructor({
    ratio = makeFrac(1),
    dur8n = makeFrac(1),
  }) {
    this.ratio = new Frac(ratio);
    this.dur8n = new Frac(dur8n);
  }
  equals(other) {
    return (
      this.ratio.equals(other.ratio) &&
      this.dur8n.equals(other.dur8n)
    );
  }
}
export class SwingChanges extends ChangesOverTime {
  constructor({
    defaultVal = new Swing({}),
    ...rest
  }) {
    super({defaultVal: defaultVal, ...rest});
  }
  _deserialize(val) {
    return new Swing(val);
  }
  _equal(a, b) {
    return a.equals(b);
  }
}

