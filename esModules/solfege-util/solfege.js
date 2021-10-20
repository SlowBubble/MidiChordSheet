import { makeSpelling } from "../chord/spell.js";

const solfegeToSpelling = {
  de: makeSpelling('C', -1),
  do: makeSpelling('C', 0),
  di: makeSpelling('C', 1),
  raw: makeSpelling('D', -2),
  ra: makeSpelling('D', -1),
  re: makeSpelling('D', 0),
  ri: makeSpelling('D', 1),
  rai: makeSpelling('D', 2),
  maw: makeSpelling('E', -2),
  me: makeSpelling('E', -1),
  mi: makeSpelling('E', 0),
  mai: makeSpelling('E', 1),
  faw: makeSpelling('F', 2),
  fe: makeSpelling('F', -1),
  fa: makeSpelling('F', 0),
  fi: makeSpelling('F', 1),
  fai: makeSpelling('F', 2),
  saw: makeSpelling('G', -2),
  se: makeSpelling('G', -1),
  so: makeSpelling('G', 0),
  si: makeSpelling('G', 1),
  sai: makeSpelling('G', 2),
  law: makeSpelling('A', -2),
  le: makeSpelling('A', -1),
  la: makeSpelling('A', 0),
  li: makeSpelling('A', 1),
  lai: makeSpelling('A', 2),
  taw: makeSpelling('B', -1),
  te: makeSpelling('B', -1),
  ti: makeSpelling('B', 0),
  tai: makeSpelling('B', 1),
};

let spellingToSolfege;

export function toSpelling(str) {
  return solfegeToSpelling[str.toLowerCase()];
}

export function toSolfege(spellingStr) {
  if (!spellingToSolfege) {
    spellingToSolfege = new Map(Object.keys(solfegeToSpelling).map(solfege => {
      return [solfegeToSpelling[solfege].toString(), solfege];
    }));
  }
  return capitalize(spellingToSolfege.get(spellingStr));
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
