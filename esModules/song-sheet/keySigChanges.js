import { Spelling } from "../chord/spell.js";
import { ChangesOverTime } from "./changesOverTime.js";

export const KeySig = Spelling;

export class KeySigChanges extends ChangesOverTime {
  constructor({
    defaultVal = new KeySig({letter: 'C'}),
    ...rest
  }) {
    super({defaultVal: defaultVal, ...rest});
  }

  _deserialize(val) {
    return new KeySig(val);
  }

  _equal(a, b) {
    return a.equals(b);
  }
}