import { makeSpelling, Spelling } from "../chord/spell.js";

const scaleNumberToSpelling = {
  1: makeSpelling('C', 0),
  2: makeSpelling('D', 0),
  3: makeSpelling('E', 0),
  4: makeSpelling('F', 0),
  5: makeSpelling('G', 0),
  6: makeSpelling('A', 0),
  7: makeSpelling('B', 0),
};

export function scaleDegreeToSpelling(scaleDegree) {
  // Need to clone since we are modifying this on the very next line.
  const res = new Spelling(scaleNumberToSpelling[scaleDegree.scaleNumber]);
  res.numSharps = scaleDegree.numSharps;
  return res;
}