import { makeSpelling, Spelling } from "../chord/spell.js";

const solfegeToSpelling = {
  de: makeSpelling('C', -1),
  do: makeSpelling('C', 0),
  du: makeSpelling('C', 1),
  ri: makeSpelling('D', -2),
  ra: makeSpelling('D', -1),
  re: makeSpelling('D', 0),
  ro: makeSpelling('D', 1),
  ru: makeSpelling('D', 2),
  mo: makeSpelling('E', -2),
  mu: makeSpelling('E', -1),
  mi: makeSpelling('E', 0),
  ma: makeSpelling('E', 1),
  faw: makeSpelling('F', 2),
  fi: makeSpelling('F', -1),
  fa: makeSpelling('F', 0),
  fe: makeSpelling('F', 1),
  fo: makeSpelling('F', 2),
  sa: makeSpelling('G', -2),
  se: makeSpelling('G', -1),
  so: makeSpelling('G', 0),
  su: makeSpelling('G', 1),
  si: makeSpelling('G', 2),
  lu: makeSpelling('A', -2),
  li: makeSpelling('A', -1),
  la: makeSpelling('A', 0),
  le: makeSpelling('A', 1),
  lo: makeSpelling('A', 2),
  to: makeSpelling('B', -2),
  tu: makeSpelling('B', -1),
  ti: makeSpelling('B', 0),
  ta: makeSpelling('B', 1),
};

let spellingToSolfege;

export function toSpelling(str) {
  const res = solfegeToSpelling[str.toLowerCase()];
  if (!res) {
    console.log("Bad solfege: ", str.toLowerCase());
  }
  // Cloning in case the caller modifies it.
  return new Spelling(res);
}

export function toSolfege(spellingStr) {
  if (!spellingToSolfege) {
    spellingToSolfege = new Map(Object.keys(solfegeToSpelling).map(solfege => {
      return [solfegeToSpelling[solfege].toString(), solfege];
    }));
  }
  const res = spellingToSolfege.get(spellingStr);
  if (!res) {
    return '';
  }
  return capitalize(res);
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
