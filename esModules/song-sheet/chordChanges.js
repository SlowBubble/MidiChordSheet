
import { Chord } from "../chord/chord.js";
import { ChangesOverTime } from "./changesOverTime.js";

export class ChordChanges extends ChangesOverTime {
  _deserialize(chord) {
    return new Chord(chord);
  }
  _equal(a, b) {
    return false;
    // return a.toString() === b.toString();
  }
}

