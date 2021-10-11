import { chunkArray } from "../array-util/arrayUtil.js";
import { makeFrac } from "../fraction/fraction.js";
import { makeSpelling } from "../chord/spell.js";

// Deps: nearley (nearley.js), grammar (melodicCell.js)

// TODO Design how to interface with parse.js.

// Strip out the Bar and GuideBar in order to populate relDur.
// For a note type, noteSpelling will be populated.
// Returns [VoiceToken]
export function parseCell(cell) {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  parser.feed(cell);
  const tokens = parser.results[0];

  const numDivisions = 1 + tokens.filter(
    token => token.type === TokenType.Bar ||
    token.type === TokenType.GuideBar
  ).length;
  const chunks = chunkArray(tokens, token => token.type === TokenType.Bar);
  const res = chunks.flatMap(chunk => {
    chunk = chunk.filter(token => token.type !== TokenType.Bar);
    const chunkWithoutGuideBars = chunk.filter(token => token.type !== TokenType.GuideBar);
    const numTokens = chunkWithoutGuideBars.length;
    const numGuideBars = chunk.length - chunkWithoutGuideBars.length;
    const numDivisionsInChunk = 1 + numGuideBars;

    return chunkWithoutGuideBars.map(token => {
      return new VoiceToken({
        relDur: makeFrac(numDivisionsInChunk, numDivisions * numTokens),
        type: token.type,
        noteInfo: token.type === TokenType.Note ? new NoteInfo({
          spelling: getSpelling(token),
          octave: token.octave + 5, // E.g. mi defaults to E5.
        }) : undefined,
      });
    });
  });
  return res;
}

export class VoiceToken {
  constructor({relDur, type, noteInfo}) {
    this.relDur = relDur;
    this.type = type;
    this.noteInfo = noteInfo;
  }
}

export class NoteInfo {
  constructor({spelling, octave}) {
    this.spelling = spelling;
    this.octave = octave;
  }
  toNoteNum() {
    return this.spelling.toNoteNum(this.octave);
  }
}

export const TokenType = {
  Bar: 'Bar',
  GuideBar: 'GuideBar',
  Note: 'Note',
  Blank: 'Blank',
  Slot: 'Slot',
  Rest: 'Rest',
}

const solfegeToLetter = {
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

function getSpelling(noteToken) {
  return solfegeToLetter[noteToken.solfege]
}