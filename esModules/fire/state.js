import * as bassComp from './bassComp.js';
import * as comp from './comp.js';
import * as chd from '../chord/chord.js';
import * as chunking from './chunking.js';
import * as debug from './debug.js';
import * as pointed from './pointed.js';
import * as frac from './frac.js';
import * as iter from './iter.js';
import * as location from './location.js';
import * as math from './math.js';
import * as spell from './spell.js';
import * as storage from './storage.js';

const CURSOR = '🐱';

function renderChordMeas(chordMeas, abcList, abcNoteDuration, measStartTime, measureEndTime) {
  if (chordMeas.length === 0) {
    // TODO possibly remove this if abcJs fixes their bug for tuplet in pickup.
    const dur = measureEndTime.minus(measStartTime);
    const mult = frac.Frac.divides(dur, abcNoteDuration);
    abcList.push(` y${mult.toString()}`);

    return;
  }
  const chordLoc = chordMeas[0];
  if (measStartTime.lessThan(chordLoc.start)) {
    const dur = chordLoc.start.minus(measStartTime);
    const mult = frac.Frac.divides(dur, abcNoteDuration);
    const blankNote = ` x${mult.toString()} `;
    abcList.push(blankNote);
  }
  chordMeas.forEach((chordLoc, idx) => {
    const endTime = (
      idx + 1 < chordMeas.length ? chordMeas[idx + 1].start :
      measureEndTime);
    const dur = endTime.minus(chordLoc.start);
    const mult = frac.Frac.divides(dur, abcNoteDuration);
    const chordString = chordLoc.chord ? chordLoc.chord.toString() : '';
    const cursor = chordLoc.onCursor ? CURSOR : '';
    const chord = ` "${cursor}${chordString}"x${mult.toString()} `;
    abcList.push(chord);
  });
}

// chunks is a list of NoteGps.
// Returns the current proximateChordIdx for the next renderMeas to use.
function renderMeas(
    chunks, abcList, currNoteGp, keySigSharpMap, timeSigDenom,
    showNotesCursor, showSpelling, abcNoteDuration, chordLocs,
    prevProximateChordIdx, measureEndTime, cursorTime) {
  if (chunks.length === 0) {
    return prevProximateChordIdx;
  }

  // TODO think about moving this block to where chunking happens
  let proximateChordIdx = prevProximateChordIdx;
  let sharpMap = {};
  chunks.forEach((chunk, chunkIdx) => {
    const noteGpsArr = chunk.getNoteGps();
    noteGpsArr.forEach((noteGp, idx) => {
      proximateChordIdx = _getProximateChordIdx(proximateChordIdx, noteGp, chordLocs);
      const proximateChord = chordLocs.length < 1 ? null : chordLocs[proximateChordIdx].chord;

      if (!noteGp.isGraceNote()) {
        // Display cursor at the unique non-grace noteGp that currNoteGp is associated with.
        if (showNotesCursor) {_displayCursor(abcList, noteGp, currNoteGp, cursorTime);}
        if (showSpelling) {_displaySpelling(abcList, noteGp, proximateChord);}
      }

      // TODO think of how to make the grace note rendering cleaner.
      if (noteGp.isGraceNote()) {
        // No need to handle grace note within a tuplet chunk. Not possible currently.
        // Start of grace note in a singleton chunk
        if (chunkIdx - 1 < 0 ||
          !(chunks[chunkIdx - 1] instanceof chunking.SingletonChunk) ||
          !chunks[chunkIdx - 1].getNoteGps()[0].isGraceNote()) {
            abcList.push('{');
        }
      }

      const alteredNoteGps = chunk.getAlteredNoteGps()[idx];
      _displayNoteGp(
        abcList, alteredNoteGps, sharpMap, keySigSharpMap, proximateChord,
        abcNoteDuration, timeSigDenom, chunk, idx);

      // TODO think of how to make the grace note rendering cleaner.
      if (noteGp.isGraceNote()) {
        // End of grace note in a singleton chunk
        if (chunkIdx + 1 > chunks.length ||
          !(chunks[chunkIdx + 1] instanceof chunking.SingletonChunk) ||
          !chunks[chunkIdx + 1].getNoteGps()[0].isGraceNote()) {
            abcList.push('}');
        }
      }
    });
  });

  _padFinalMeasure(abcList, measureEndTime, chunks, abcNoteDuration);
  return proximateChordIdx;
}

// Split the interval between startTime and endTime if it crosses measure boundaries.
function _split(startTime, endTime, durationPerMeasure) {
  const res = [];
  let currStartTime = startTime;
  while (true) {
    const cutoffTime = location.nextMeasureTime(currStartTime, durationPerMeasure);
    const currEndTime = cutoffTime.lessThan(endTime) ? cutoffTime : endTime;
    res.push({
      start: currStartTime,
      end: currEndTime
    });
    if (currEndTime.geq(endTime)) {
      break;
    }
    currStartTime = currEndTime;
  }
  return res;
}

function _displayCursor(abcList, noteGp, currNoteGp, cursorTime) {
  // Use equality of start because other parts of currNoteGp
  // may have been changed.
  if (!currNoteGp) {
    return;
  }
  if (!cursorTime.equals(noteGp.start)) {
    return;
  }
  abcList.push(`"<${CURSOR}"`);

  if (!currNoteGp.isGraceNote()) {
    return;
  }

  const abcSpelling = spell.fromNoteNum(currNoteGp.getNotes()[0].noteNum);
  // TODO think of better ways show that the cursor is pointing to a grace note.
  abcList.push(`"<${abcSpelling}"`);
}

function _displaySpelling(abcList, noteGp, proximateChord) {
  if (noteGp.tie) {
    return;
  }
  noteGp.getNotes().forEach(note => {
    if (!note.noteNum) {
      return;
    }
    const spelling = (
      note.spelling ? note.spelling :
      spell.fromNoteNumWithChord(note.noteNum, proximateChord));
    abcList.push(`">${spelling.toString()}"`);
  });
}

function _displayNoteGp(
    abcList, noteGp, sharpMap, keySigSharpMap, proximateChord,
    abcNoteDuration, timeSigDenom, chunk, idx) {
  // Add space to break beams when denom is 4, 2 or 1 for timeSig 3/4 or 4/4, .
  if (idx === 0 && frac.build(timeSigDenom, noteGp.start.denom).isWhole()) {
    abcList.push(' ');
  }
  if (idx === 0 && chunk.getAbcPreamble()) {
    abcList.push(chunk.getAbcPreamble())
  }
  const hasMultNotes = noteGp.getNotes().length > 1;
  if (hasMultNotes) {
    abcList.push('[');
  }
  const dur = noteGp.getDuration();
  // TODO handle tuplets i.e. C'2/3D'2/3E'2/3 -> (3:2C'D'E'
  noteGp.getNotes().forEach(note => {
    // TODO duration being 5/8 is not working.
    let abcNote = noteNumToAbc(note, sharpMap, keySigSharpMap, proximateChord);
    if (noteGp.isGraceNote()) {
      // The grace notes braces are added outside of this function
      // in order to support multiple grace notes.
      abcList.push(`${abcNote}`);
    } else {
      const mult = frac.Frac.divides(dur, abcNoteDuration);
      abcNote += mult.toString();
      abcList.push(abcNote);
    }
  });
  if (hasMultNotes) {
    abcList.push(']');
  }
  if (noteGp.tie) {
    abcList.push("-");
  }
}

function _getProximateChordIdx(proximateChordIdx, noteGp, chordLocs) {
  // if (noteGp.start.lessThan(chordLocs[proximateChordIdx].start)) {
    // TODO a good initial chord is the dominant of the starting chord; e.g. C7 -> F.
    // return dominantChordOf(chordLocs[proximateChordIdx]);
  // }

  for (let idx = proximateChordIdx + 1; idx < chordLocs.length; idx++) {
    const chordLoc = chordLocs[idx];
    if (noteGp.start.lessThan(chordLoc.start)) {
      break;
    }
    proximateChordIdx = idx;
  }
  return proximateChordIdx;
}

function _padFinalMeasure(abcList, measureEndTime, chunks, abcNoteDuration) {
  const lastNoteGps = chunks[chunks.length - 1].getNoteGps();
  const lastNoteGp = lastNoteGps[lastNoteGps.length - 1];
  const remainingDuration = measureEndTime.minus(lastNoteGp.end);
  if (remainingDuration.toFloat() <= 0) {
    return;
  }
  const mult = frac.Frac.divides(remainingDuration, abcNoteDuration);
  abcList.push('x' + mult.toString());
}

function _computeKeySigSharpMap(keySigSp) {
  const sharpMap = {};
  // Case 1: flats
  if (keySigSp.toString() === 'C') {
    return sharpMap;
  }
  if (keySigSp.numSharps < 0 || keySigSp.toString() === 'F') {
    let currNoteNum = keySigSp.toNoteNum();
    while (true) {
      const currFourth = spell.fromNoteNumWithFlat(math.mod(currNoteNum + 5, 12));
      sharpMap[currFourth.letter] = sharpMap[currFourth.letter] || 0;
      sharpMap[currFourth.letter] -= 1;
      // Go up a fifth for the next iteration; e.g. Bb -> F
      currNoteNum = math.mod(currNoteNum + 7, 12);
      if (currNoteNum == 0) {
        return sharpMap;
      }
    }
  }
  // Case 2: sharps
  let currNoteNum = keySigSp.toNoteNum();
  while (true) {
    const currSeventh = spell.fromNoteNumWithSharp(math.mod(currNoteNum + 10, 12));
    sharpMap[currSeventh.letter] = sharpMap[currSeventh.letter] || 0;
    sharpMap[currSeventh.letter] += 1;
    // Go up down a fifth for the next iteration; e.g. D -> G
    currNoteNum = math.mod(currNoteNum - 7, 12);
    if (currNoteNum == 0) {
      return sharpMap;
    }
  }
}


function getOctaveNum(num, spelling) {
  const noteNumDiff = num - spelling.toNoteNum(0);
  if (math.mod(noteNumDiff, 12) !== 0) {
    console.warn('This spelling does not have the expected note number (mod 12).', spelling, num);
  }
  // Minus 1 because 24 -> C1
  return Math.floor(noteNumDiff / 12) - 1;
}

// sharpMap may get mutated. keySigSharpMap will not get mutated.
const noteNumToAbc = (note, sharpMap, keySigSharpMap, chord) => {
  const num = note.noteNum;
  if (!num) {
    return 'z';
  }
  sharpMap = sharpMap || {};
  // TODO use the chord in the current/next measure to spell this correctly.
  const spelling = note.spelling ? note.spelling : spell.fromNoteNumWithChord(num, chord);
  const octaveNum = getOctaveNum(num, spelling);
  const sharpMapKey = `${spelling.letter}${octaveNum}`;
  const prevNumSharps = (
    sharpMap[sharpMapKey] === undefined ?
    keySigSharpMap[spelling.letter] || 0 : sharpMap[sharpMapKey]);
  sharpMap[sharpMapKey] = spelling.numSharps;

  // Add natural if previous notes have accidentals.
  if (prevNumSharps && spelling.numSharps === 0) {
    spelling.hasNatural = true;
  }

  // Don't add accidentals if previous notes have already done it.
  if (spelling.numSharps === prevNumSharps) {
    spelling.numSharps = 0;
  }
  return spelling.toAbc(octaveNum);
}

// A location is an object with start time.
// A measure consists of the measure number and the content, which is a list of locations.
// A line is a list of measure content.
function locationsToLines(locations, durationPerMeasure, barsPerLine, numPickupMeas) {
  // A measure is an array of locations object.
  let currMeas;
  let currMeasNum;
  const measures = [];
  locations.forEach(loc => {
    const measNum = location.measureNum(loc.start, durationPerMeasure);
    if (measNum === currMeasNum) {
      currMeas.push(loc);
      return;
    }
    currMeas = [loc];
    currMeasNum = measNum;

    // Fill in empty measures if the locations are sparse (e.g. chords or near the end for noteGps).
    while (measNum > measures.length - numPickupMeas) {
      measures.push({content: [], measNum: measures.length - numPickupMeas});
    }

    measures.push({content: currMeas, measNum: measNum});
  });

  // A line is an array of measures
  const lines = [];
  let currLine;
  let currLineNum;
  measures.forEach(meas => {
    const lineNum = location.lineNum(meas.measNum, barsPerLine);
    if (lineNum === currLineNum) {
      currLine.push(meas.content);
      return;
    }
    currLine = [meas.content];
    currLineNum = lineNum;
    lines.push(currLine);
  });
  return lines;
}

export class Note {
  constructor(noteNum, spelling) {
    // null means rest.
    this.noteNum = noteNum;
    this.spelling = spelling || null;
  }

  static fromJson(json) {
    return new Note(
      json.noteNum,
      spell.fromJson(json.spelling));
  }

  equals(n2) {
    return this.noteNum === n2.noteNum;
  }

  clone() {
    return new Note(
      this.noteNum,
      // TODO clone this.
      this.spelling,
    );
  }
}

export class NoteGp {
  constructor(notes, start, end, tie, startMillis) {
    if (notes.length > 1) {
      notes.sort((n1, n2) => { return n1.noteNum - n2.noteNum});
    }
    this.notes = notes;
    this.start = start;
    this.end = end;
    this.tie = tie || false;
    this.startMillis = startMillis || 0;
  }

  static fromJson(json) {
    const notes = json.notes.map(jsonNote => {
      return Note.fromJson(jsonNote);
    });
    return new NoteGp(
      notes,
      frac.fromJson(json.start),
      frac.fromJson(json.end),
      json.tie,
      json.startMillis);
  }

  clone() {
    return new NoteGp(
      this.notes.map(note => {
        return note.clone();
      }),
      this.start,
      this.end,
      this.tie,
      this.startMillis,
    );
  }

  equals(ng2) {
    if (!this.start.equals(ng2.start)) {
      return false;
    }
    if (!this.end.equals(ng2.end)) {
      return false;
    }
    if (this.notes.length !== ng2.notes.length) {
      return false;
    }
    for (let i = 0; i < this.notes.length; i++) {
      if (!this.notes[i].equals(ng2.notes[i])) {
        return false;
      }
    }
    if (this.tie !== ng2.tie) {
      return false;
    }
    return true;
  }

  isRest() {
    return this.notes.length === 1 && this.notes[0].noteNum == null;
  }

  isGraceNote() {
    return this.start.equals(this.end)
  }

  getNotes() {
    return this.notes;
  }

  getDuration() {
    return this.end.minus(this.start);
  }

  setDuration(duration) {
    this.end = this.start.plus(duration);
  }

  weaklyInside(left, right) {
    return (
      this.start.weaklyInside(left, right) &&
      this.end.weaklyInside(left, right));
  }

  // Return 2 notes.
  // [null, this] if start >= middleTime.
  // [this, null] if end <= middleTime.
  split(middleTime) {
    if (this.start.geq(middleTime)) {
      return [null, this];
    }
    if (this.end.leq(middleTime)) {
      return [this, null];
    }
    const left = this.clone();
    left.end = middleTime;
    if (!this.isRest()) {
      left.tie = true;
    }
    const right = this.clone();
    right.start = middleTime;
    return [left, right];
  }
}

export class Chord {
  constructor(str, start) {
    this.str = str;
    this.start = start;
  }
}

function fixEnds(noteGpsArray) {
  return noteGpsArray.map((noteGp, idx) => {
    const nextNoteGp = idx + 1 >= noteGpsArray.length ? null : noteGpsArray[idx + 1];
    if (!nextNoteGp) {
      return noteGp;
    }
    if (nextNoteGp.start.equals(noteGp.end)) {
      return noteGp;
    }
    const clone = noteGp.clone();
    clone.end = nextNoteGp.start;
    console.warn('Fixing ends from and to.', noteGp, clone);
    return clone;
  });
}

function splitBefore(phrase, delimiterSubregexString) {
  // use positive look-ahead so that the split doesn't remove the delimiter.
  return phrase.split(new RegExp(`(?=${delimiterSubregexString})`));
}

function splitAfter(phrase, delimiterSubregexString) {
  // use positive look-behind so that the split doesn't remove the delimiter.
  return phrase.split(new RegExp(`(?<=${delimiterSubregexString})`));
}

function toLyricsTokens(lyricsString) {
  const asianRegexStr = '[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]';
  const tokens = lyricsString.split(/[\s]+/).flatMap(phrase => {
    // 'ab-cd' => ['ab-', 'cd']
    return splitAfter(phrase, '-');
  }).flatMap(phrase => {
    // Not using splitAfter here because we want:
    // '天?' => ['天?']
    // '天如' => ['天', '如']
    return splitBefore(phrase, asianRegexStr)
  });
  return tokens;
}

function fromLyricsToken(tokens) {
  return tokens.join(' ');
}

export class Voice {
  constructor(noteGps, clef) {
    this.noteGps = noteGps || new pointed.List;
    this.clef = clef || 'treble';
  }

  static fromJson(json) {
    const noteGpsArray = json.noteGps.map(jsonItem => {
      return NoteGp.fromJson(jsonItem)
    });
    return Voice.fromNoteGpsArray(noteGpsArray, json.clef);
  }

  static fromNoteGpsArray(noteGpsArray, clef) {
    const merged = fixEnds(chunking.mergeTiesAndRests(noteGpsArray));
    const noteGpsIdx = 0;
    const noteGps = new pointed.List(merged, noteGpsIdx);
    return new Voice(noteGps, clef);
  }

  toJson() {
    return {
      noteGps: this.noteGps.toArray(),
      clef: this.clef,
    };
  }

  // TODO move this to a toString method of abc.js
  /**
   * Measures layout (measure -1 is the pickup measure)
   * line 0 : -1 | 0 | 1 | 2 | 3 |
   * line 1:       4 | 5 | 6 | 7 |
   * line 2:       8 | ...
   */
  getAbcStrings(abcNoteDuration, doc, showSpelling, chordLocs,
    displayChords, showNotesCursor, idx, cursorTime) {
    if (doc.displayMelodyOnly && idx !== 0) {
      return;
    }

    const timeSigNumer = doc.timeSigNumer;
    const timeSigDenom = doc.timeSigDenom;
    const pickup = doc.pickup;
    const keySigSp = doc.keySigSp;
    const keySigLocs = doc.keySigLocs;
    const tokens = doc.lyricsTokens;

    const durationPerMeasure = frac.build(timeSigNumer, timeSigDenom);
    const barsPerLine = 4;
    const abcList = [
      `V:${idx} clef=${this.clef}\n`,
    ];

    const numPickupMeas = -location.measureNum(pickup.negative(), durationPerMeasure);

    const chordLines = locationsToLines(chordLocs, durationPerMeasure, barsPerLine, numPickupMeas);
    const chordLinesToDisplay = displayChords ? chordLines : [];
    chordLocs = chordLines.flat().flat();
    const noteLines = locationsToLines(
      chunking.periodicSplit(this.noteGps.toArray(), durationPerMeasure),
      durationPerMeasure, barsPerLine, numPickupMeas);
    const keySigLines = locationsToLines(keySigLocs, durationPerMeasure, barsPerLine, numPickupMeas);

    let keySigSharpMap = _computeKeySigSharpMap(keySigSp);

    // The default key signature must be specified per voice
    // because it can be overriden by a previous voice.
    abcList.push(` [K:${keySigSp.toString()}] `);
    const numLines = Math.max(noteLines.length, chordLinesToDisplay.length);

    // Add cursor after the key sig for the no note lines case.
    if (!noteLines.length) {
      if (showNotesCursor) {
        abcList.push(`"<${CURSOR}"x`);
      }
    }
    if (!numLines) {
      abcList.push('|]\n');
      return abcList;
    }

    let proximateChordIdx = 0;
    let tokenIdx = 0;
    let nextTokenIsBlank = false;
    // These loop variables are needed because it's possible to have an empty noteMeas
    // (because of end of all notes) and an empty chordMeas (because of unchanging chord).
    let measStartTime = pickup.negative();
    let measEndTime = pickup.toFloat() > 0 ? frac.build(0) : durationPerMeasure;

    math.range(0, numLines).forEach(lineIdx => {
      const noteMeasures = lineIdx < noteLines.length ? noteLines[lineIdx] : [];
      const chordMeasures = lineIdx < chordLinesToDisplay.length ? chordLinesToDisplay[lineIdx] : [];
      const keySigMeasures = lineIdx < keySigLines.length ? keySigLines[lineIdx] : [];
      const numMeas = Math.max(noteMeasures.length, chordMeasures.length);
      const noteGpsArrsForLyricsLine = [];
      math.range(0, numMeas).forEach(measIdx => {
        const noteMeas = measIdx < noteMeasures.length ? noteMeasures[measIdx] : [];
        const chordMeas = measIdx < chordMeasures.length ? chordMeasures[measIdx] : [];
        const keySigMeas = measIdx < keySigMeasures.length ? keySigMeasures[measIdx] : [];
        if (keySigMeas.length > 0) {
          const keySigLoc = keySigMeas[0];
          abcList.push(` [K:${keySigLoc.keySigSp.toString()}] `);
          keySigSharpMap = _computeKeySigSharpMap(keySigLoc.keySigSp);
        }
        // Pad an empty measure that's sandwiched between non-empty measures.
        if (noteMeas.length == 0 && chordMeas.length == 0) {
          const measDuration = measEndTime.minus(measStartTime);
          const mult = frac.Frac.divides(measDuration, abcNoteDuration);
          abcList.push(` x${mult.toString()}`)
        }

        // startTime is recomputed because we want it to work for pickup measure also
        const chunks = chunking.exec(
          noteMeas, measEndTime.minus(durationPerMeasure), measEndTime,
          timeSigNumer, timeSigDenom, showNotesCursor ? cursorTime : null);
        if (doc.displayLyrics && idx === 0 && tokenIdx < tokens.length) {
          noteGpsArrsForLyricsLine.push(chunks.map(chunk => {
            return chunk.getNoteGps();
          }).flat());
        }
        proximateChordIdx = renderMeas(
          chunks,
          abcList, this.noteGps.getCurr(), keySigSharpMap,
          timeSigDenom, showNotesCursor, showSpelling,
          abcNoteDuration, chordLocs, proximateChordIdx, measEndTime, cursorTime);

        // Separate meas and chordMeas as 2 voice parts.
        if (noteMeas.length > 0
          // TODO add this back if renderChordMeas stop using y-spacer for empty chordMeas
          // && chordMeas.length > 0
        ) {
          abcList.push('& ');
        }

        renderChordMeas(
          chordMeas, abcList, abcNoteDuration, measStartTime, measEndTime);

        // Add cursor to the last measure if cursor is at the tail.
        const isFinalNoteMeas = lineIdx === noteLines.length - 1 && measIdx === noteMeasures.length - 1;
        if (isFinalNoteMeas && showNotesCursor && this.noteGps.atTail()) {
          const cursorOnNextMeas = measEndTime.equals(cursorTime);
          if (cursorOnNextMeas) {
            abcList.push(` | `);
          }
          abcList.push(`"<${CURSOR}"x`);
          if (!cursorOnNextMeas) {
            abcList.push(` | `);
          }
        } else {
          const isFinalMeas = lineIdx === numLines - 1 && measIdx === numMeas - 1;
          const barLine = isFinalMeas ? ' |]' : '| ';
          abcList.push(barLine);
        }

        // Update loop variables.
        measStartTime = measEndTime;
        measEndTime = measEndTime.plus(durationPerMeasure);
      });
      abcList.push('\n');

      // Lyrics
      if (noteGpsArrsForLyricsLine.flat().length === 0) {
        return;
      }
      abcList.push('w: ');
      noteGpsArrsForLyricsLine.forEach(noteGpsArr => {
        noteGpsArr.forEach(noteGp => {
          if (noteGp.isRest() || noteGp.isGraceNote()) {
            return;
          }
          const currTokenIsBlank = nextTokenIsBlank;
          nextTokenIsBlank = noteGp.tie;
          if (currTokenIsBlank) {
            abcList.push('* ');
            return;
          }
          if (tokenIdx >= tokens.length) {
            return;
          }
          abcList.push(`${tokens[tokenIdx]} `);
          tokenIdx++;
        });
        abcList.push(' | ')
      });
      abcList.push('\n');
    });
    return abcList;
  }
}

class ChordLoc {
  constructor(chord, start, onCursor) {
    // Can be null, for holding a cursor, or the start time of chordless measures.
    this.chord = chord;
    this.start = start;
    // TODO put this field in a wrapper object instead, e.g. ChordRendering.
    // This field is only used during rendering; won't be persisted.
    this.onCursor = onCursor || false;
  }

  static fromJson(json) {
    return new ChordLoc(
      new chd.Chord(json.chord),
      frac.fromJson(json.start),
    );
  }

  clone() {
    return new ChordLoc(this.chord, this.start);
  }
}

class KeySigLoc {
  constructor(keySigSp, start) {
    this.keySigSp = keySigSp;
    this.start = start;
  }

  static fromJson(json) {
    return new KeySigLoc(
      spell.fromJson(json.keySigSp),
      frac.fromJson(json.start),
    );
  }
}

class TimeSigLoc {
  constructor(timeSigNumer, timeSigDenom, start) {
    this.timeSigNumer = timeSigNumer;
    this.timeSigDenom = timeSigDenom;
    this.start = start;
  }

  static fromJson(json) {
    return new TimeSigLoc(
      json.timeSigNumer,
      json.timeSigDenom,
      frac.fromJson(json.start),
    );
  }
}

const NO_TITLE = 'Unnamed';

class Doc {
  constructor(
    title, timeSigNumer, timeSigDenom, keySigSp, tempo, voices, pickup,
    composer, owner, cloneId, chordLocs, keySigLocs, tempoStr, timeSigLocs,
    lyricsTokens) {
    this.title = title || NO_TITLE;
    this.timeSigNumer = timeSigNumer || 4;
    this.timeSigDenom = timeSigDenom || 4;
    this.keySigSp = keySigSp || new spell.Spelling('C');
    this.tempo = tempo || 80;
    this.voices = voices || [new Voice()];
    this.pickup = pickup || frac.build(0);
    this.composer = composer || '';
    this.owner = owner || '';
    this.cloneId = cloneId || '';
    this.chordLocs = chordLocs ? chordLocs : [];
    this.keySigLocs = keySigLocs || [];
    this.tempoStr = tempoStr || '';
    // TODO make use of this field once we sort out method that require
    // time sig to be constant.
    // Approach 1. Look at all usages of getDurationPerMeasure and location.js
    // Approach 2. Just switch and see what is broken.
    this.timeSigLocs = timeSigLocs || [];
    this.lyricsTokens = lyricsTokens || [];

    this.displayMelodyOnly = false;
    this.displayLyrics = true;
  }

  static fromJson(json) {
    return new Doc(
      json.title,
      json.timeSigNumer,
      json.timeSigDenom,
      spell.fromJson(json.keySigSp),
      json.tempo,
      json.voices.map(voice => { return Voice.fromJson(voice); }),
      frac.fromJson(json.pickup),
      json.composer,
      json.owner,
      json.cloneId,
      json.chordLocs ? json.chordLocs.map(loc => { return ChordLoc.fromJson(loc); }) : [],
      json.keySigLocs ? json.keySigLocs.map(loc => { return KeySigLoc.fromJson(loc); }) : [],
      json.tempoStr,
      json.timeSigLocs ? json.timeSigLocs.map(loc => { return TimeSigLoc.fromJson(loc); }) : [],
      json.lyricsTokens,
    );
  }

  toJson() {
    return {
      title: this.title,
      timeSigNumer: this.timeSigNumer,
      timeSigDenom: this.timeSigDenom,
      keySigSp: this.keySigSp,
      tempo: this.tempo,
      voices: this.voices.map(voice => { return voice.toJson(); }),
      pickup: this.pickup,
      composer: this.composer,
      owner: this.owner,
      cloneId: this.cloneId,
      chordLocs: this.chordLocs,
      keySigLocs: this.keySigLocs,
      tempoStr: this.tempoStr,
      timeSigLocs: this.timeSigLocs,
      lyricsTokens: this.lyricsTokens,
    };
  }

  setVoices(voices) {
    this.voices = voices;
  }

  clearChords() {
    this.chordLocs = [];
  }

  shiftToKey(newKeySp, shiftUp) {
    const  shift = math.mod(newKeySp.toNoteNum() - this.keySigSp.toNoteNum(), 12) + shiftUp * 12;
    // 1. Chords
    this.chordLocs.forEach(chordLoc => {
      chordLoc.chord.root = chordLoc.chord.root.shift(this.keySigSp, newKeySp, shift);
      if (chordLoc.chord.bass) {
        chordLoc.chord.bass = chordLoc.chord.bass.shift(this.keySigSp, newKeySp, shift);
      }
    });

    // 2. Voices
    this.voices.forEach(voice => {
      voice.noteGps.toArray().forEach(noteGp => {
        noteGp.notes.forEach(note => {
          if (!note.noteNum) {
            return;
          }
          note.noteNum = note.noteNum + shift;
        });
      });
    });

    // 3. Key Sig
    this.keySigSp = newKeySp;
  }
}

export class Editor {
  constructor(step, currVoiceIdx, cursorOnChords, cursorTime) {
    this.step = step || frac.build(1, 4);
    this.currVoiceIdx = currVoiceIdx || 0;
    this.cursorOnChords = cursorOnChords || false;
    this.cursorTime = cursorTime || new frac.build(0);
  }

  static fromJson(json) {
    return new Editor(
      frac.fromJson(json.step),
      json.currVoiceIdx,
      json.cursorOnChords,
      frac.fromJson(json.cursorTime));
  }

}

export class Part {
  constructor(id, keySigSp, shiftUp, shiftIn) {
    this.id = id || '';
    this.keySigSp = keySigSp || null;
    this.shiftUp = shiftUp || 0;
    this.shiftIn = shiftIn || false;
  }

  getLink() {
    const url = new URL(document.URL);
    const songUrl = new URL('/fire/music.html', url.origin);
    songUrl.searchParams.set('view', '1');
    songUrl.searchParams.set('id', this.id);
    songUrl.searchParams.set('shiftUp', this.shiftUp.toString());
    songUrl.searchParams.set('shiftIn', this.shiftIn.toString());
        if (this.keySigSp) {
          songUrl.searchParams.set('keySig', this.keySigSp.toString());
        }
    return songUrl.href;
  }

  static fromLink(link) {
    const url = new URL(link);
    const id = url.searchParams.get('id');
    if (!id) {
      throw 'Invalid link due to missing id: ' + link;
    }
    let keySigSp = null;
    const keySigStr = url.searchParams.get('keySig');
    if (keySigStr) {
      const chord = _parseChordStr(keySigStr);
      if (chord) {
        keySigSp = chord.root;
      }
    }
    const shiftUp = parseInt(url.searchParams.get('shiftUp'));
    return this.fromJson({
      id: id,
      link: link,
      keySigSp: keySigSp,
      shiftUp: isNaN(shiftUp) ? 0 : shiftUp,
      // TODO think about whether this belong in the url.
      // If not and this is a useful feature, we will need proper merging.
      shiftIn: url.searchParams.get('shiftIn') == '1',
    });
  }

  static fromJson(json) {
    return new Part(
      json.id,
      spell.fromJson(json.keySigSp),
      json.shiftUp,
      json.shiftIn);
  }
}

export class StateMgr {
  constructor(ebanner, urlId, shadowRoot, execPub) {
    this.ebanner = ebanner;
    this.urlId = urlId;
    this.shadowRoot = shadowRoot;
    this.execPub = execPub;

    this.doc = new Doc;
    this.editor = new Editor;
    this.parts = [];
    // TODO auto-compute this based on the notes' GCD.
    this.abcNoteDuration = frac.build(1, 8);
    this.showSpelling = false;
    this.noteNumShift = 0;
    this.seed = 54;
    this.isTrumpet = false;
  }

  loadJson(json) {
    this.doc = Doc.fromJson(json.doc);
    this.editor = Editor.fromJson(json.editor);
    this.setCursorTimeSyncPointer(this.getCursorTime());

    this.parts = json.parts ? json.parts.map(pJson => {return Part.fromJson(pJson); }) : [];
    this.loadParts();

    const url = new URL(document.URL);
    const keySigStr = url.searchParams.get('keySig');
    const shiftUp = parseInt(url.searchParams.get('shiftUp'));
    this.shiftToKey(keySigStr, isNaN(shiftUp) ? 0 : shiftUp);

    if (this.doc.cloneId !== '') {
      const cloneAnchor = this.shadowRoot.querySelector('#clone-anchor');
      cloneAnchor.style.display = 'inline';
      cloneAnchor.href = getSongUrl(this.doc.cloneId);
    }
  }

  toJson() {
    return {
      doc: this.doc.toJson(),
      editor: this.editor,
      parts: this.parts,
    };
  }

  setUrlId(urlId) {
    this.urlId = urlId;
  }

  switchInstrumentFingering() {
    this.isTrumpet = !this.isTrumpet;
    this.ebanner.display(`Instrument fingering: ` + (this.isTrumpet ? 'jkl-trumpet' : '12345-piano'));
  }

  quantize() {
    const arr = this.getCurrVoice().noteGps.toArray();
    const durations = arr.map((noteGp, idx) => {
      if (idx + 1 >= arr.length) {
        return null;
      }
      const dur = arr[idx + 1].startMillis - noteGp.startMillis;
      if (dur > 0) {
        return dur;
      }
      return null;
    });
    const maxDur = Math.max(...durations);
    const cleanedDurs = durations.map(dur => {
      return dur === null ? maxDur : dur;
    });
    const minDur = Math.min(...cleanedDurs);
    // const ratios = cleanedDurs.map(dur => {
    //   return dur / minDur;
    // });
    if (minDur <= 0) {
      return;
    }
    const roundedRatios = cleanedDurs.map(dur => {
      return Math.round(dur / minDur);
    });
    let beatDur = frac.build(1, 4);
    if (minDur < 400) {
      beatDur = frac.build(1, 16)
    } else if (minDur < 800) {
      beatDur = frac.build(1, 8);
    }
    const projectedDurs = roundedRatios.map(ratio => {
      return beatDur.times(frac.build(ratio));
    });
    this.navTail();
    while (!this.atHead()) {
      this.shortenPrevNoteGp();
    }
    arr.forEach((noteGp, idx) => {
      this.upsertByDur(
        noteGp.notes.map(note => {return note.noteNum;}),
        projectedDurs[idx],
        noteGp.startMillis);
    });
  }

  serialize() {
    // console.log(JSON.stringify(this.toJson(), null, 2));
    return JSON.stringify(this.toJson());
  }

  // Only support Chinese currently.

  updateLyrics(lyricsString) {
    this.doc.lyricsTokens = toLyricsTokens(lyricsString);
  }

  shiftNoteGpBoundary(goLeft) {
    if (this.isChordMode()) {
      return;
    }
    const noteGps = this.getCurrVoice().noteGps;
    const left = noteGps.getLeft();
    const right = noteGps.getCurr();
    const step = this.editor.step.over(frac.build(2));
    if (this.atHead() && !goLeft && right && right.getDuration().greaterThan(step)) {
      const old = right.start;
      right.start = right.start.plus(step);
      this.addRestInGap(old, right.start);
      return;
    }
    if (!left || !right) {
      return;
    }
    if (left.isGraceNote() || right.isGraceNote()) {
      return;
    }

    const denomToUse = Math.max(step.denom, left.end.denom);
    // TODO what if left.end is a 1/6 instead of 1/8?
    const roundedStep = frac.build(1, denomToUse);
    let boundary = left.end;
    if (goLeft) {
      if (left.getDuration().leq(roundedStep) || chunking.isPossibleTuplet(left)) {
        boundary = left.start;
        this.unsafeRemoveFromNoteGps();
      } else {
        boundary = left.end.minus(roundedStep);
      }
    } else {
      if (right.getDuration().leq(roundedStep) || chunking.isPossibleTuplet(right)) {
        boundary = right.end;
        this.skipRight();
        this.unsafeRemoveFromNoteGps();
      } else {
        boundary = right.start.plus(roundedStep);
      }
    }
    left.end = boundary;
    right.start = boundary;

    this.setCursorTimeSyncPointer(boundary);
  }

  appendPart(link) {
    this.parts.push(Part.fromLink(link));
    this.loadParts(true);
  }

  insertPart(link, idx) {
    this.parts.splice(idx, 0, Part.fromLink(link));
    this.loadParts(true);
  }

  removePart(idx) {
    this.parts.splice(idx, 1);
    this.loadParts(true);
  }

  async loadParts(loadDocWithParts) {
    const partDocs = [];
    const partTitles = [];
    const partShiftIns = [];
    let failed = false;
    // TODO use promise.all to make each loop run concurrently.
    for (const part of this.parts) {
      const json = await storage.retrieve(part.id);
      if (!json) {
        partTitles.push(part.id);
        failed = true;
        continue;
      }
      partShiftIns.push(part.shiftIn);
      const doc = Doc.fromJson(json.doc);
      partDocs.push(doc);
      partTitles.push(doc.title);
      if (part.keySigSp) {
        doc.shiftToKey(part.keySigSp, part.shiftUp);
      }
    }
    this._updateUi(partTitles);
    if (failed) {
      return;
    }
    if (!loadDocWithParts) {
      return;
    }
    if (partDocs.length === 0) {
      this.doc = new Doc;
    }
    partDocs.forEach((partDoc, idx) => {
      if (loadDocWithParts) {
        if (idx === 0) {
          // Blacklisted fields to not update when reloading.
          // The rest of the fields will be auto-updated
          partDoc.owner = this.doc.owner;
          if (this.doc.cloneId !== '') {
            partDoc.cloneId = this.doc.cloneId;
          }
          if (this.doc.title !== NO_TITLE) {
            partDoc.title = this.doc.title;
          }
          if (this.doc.composer !== '') {
            partDoc.composer = this.doc.composer;
          }

          this.doc = partDoc;
        } else {
          this.appendDoc(partDoc, partShiftIns[idx]);
        }
      }
    });
    this.execPub();
  }

  appendDoc(doc, shiftIn) {
    const maxEndTime = this._getMaxEndTime();
    const durPerMeas = this.getDurationPerMeasure();
    const measNum = location.measureNum(maxEndTime, durPerMeas);
    const possNextMeasTime = location.measureNumToTime(
      measNum, durPerMeas, this.doc.pickup);
    const maxEndTimeIsNextMeasTime = possNextMeasTime.equals(maxEndTime);
    const nextMeasTime = (
      maxEndTimeIsNextMeasTime ? maxEndTime :
      location.measureNumToTime(measNum + 1, durPerMeas, this.doc.pickup));
    const currMeasTime = nextMeasTime.minus(durPerMeas);
    const shiftTime = shiftIn ? currMeasTime : nextMeasTime;
    const docStartTime = (shiftIn ? currMeasTime : nextMeasTime).minus(doc.pickup);
    if (!doc.keySigSp.equals(this.doc.keySigSp)) {
      this.doc.keySigLocs.push(new KeySigLoc(doc.keySigSp, docStartTime));
    }
    // TODO deal with the case where the firs doc does not have lyrics
    // while the second doc has lyrics, by padding with _
    if (doc.lyricsTokens) {
      this.doc.lyricsTokens.push(...doc.lyricsTokens);
    }

    this.disableChordMode();
    // Start appending. Note that if there are fewer voices, the dropped voice's
    // measures will be empty and will only be filled in by future docs with
    // extra voices.
    doc.voices.forEach((voice, idx) => {
      if (idx >= this.doc.voices.length) {
        this.addVoice(new Voice(null, voice.clef));
      }
      this.setVoiceIdx(idx);
      this.navTail();

      const noteGpsForAppend = [];
      let atInitialRest = true;
      let initialRestDuration = frac.build(0);
      const prevDocEndTime = this.getCursorTime();
      voice.noteGps.toArray().forEach(noteGp => {
        if (atInitialRest && noteGp.isRest() && !prevDocEndTime.lessThan(noteGp.end)) {
          initialRestDuration = initialRestDuration.plus(noteGp.getDuration());
          return;
        }
        atInitialRest = false;
        noteGpsForAppend.push(noteGp);
      });
      const actualDocStartTime = docStartTime.plus(initialRestDuration);

      // Pad the current voice of the current doc.
      while (actualDocStartTime.lessThan(this.getCursorTime())) {
        this.shortenPrevNoteGp();
      }
      // TODO When tieless is available, just insert rest
      // with duration docStartTime.minus(this.getCursorTime()).
      while (this.getCursorTime().lessThan(actualDocStartTime)) {
        const currTime = this.getCursorTime();
        const nextMeasTime = location.nextMeasureTime(currTime, durPerMeas);
        // If currTime to actualDocStartTime spans multiple measures (e.g.
        // previous doc has a missing voice), use nextMeasTime for end of inserted rest.
        const restEnd = nextMeasTime.lessThan(actualDocStartTime) ? nextMeasTime : actualDocStartTime;
        const restDuration = restEnd.minus(currTime);
        this.upsertByDur([null], restDuration);
      }

      // Start appending.
      noteGpsForAppend.forEach(noteGp => {
        noteGp.start = noteGp.start.plus(shiftTime);
        noteGp.end = noteGp.end.plus(shiftTime);
        this.unsafeAddToNoteGps(noteGp);
      });
    });

    this.enableChordMode();
    doc.chordLocs.forEach(chordLoc => {
      chordLoc.start = chordLoc.start.plus(shiftTime);
      this._insertChordLoc(chordLoc);
    });
    this.navHead();
  }

  _updateUi(partTitles) {
    // Clean up UI.
    const partsListDiv = this.shadowRoot.querySelector('#parts-list');
    // TODO this is only here because musicMobileMain relies on stateMgr
    // but doesn't have parts-list.
    if (!partsListDiv) {
      return;
    }
    while (partsListDiv.firstChild) {
      partsListDiv.removeChild(partsListDiv.firstChild);
    }

    partTitles.forEach((title, idx) => {
      const insertButton = document.createElement('button');
      insertButton.textContent = '+';
      insertButton.classList.add('insert-part');
      insertButton.setAttribute('data-idx', idx.toString());
      partsListDiv.appendChild(insertButton);

      const removeButton = document.createElement('button');
      removeButton.textContent = 'X';
      removeButton.classList.add('remove-part');
      removeButton.setAttribute('data-idx', idx.toString());
      partsListDiv.appendChild(removeButton);

      const anchor = document.createElement("a");
      anchor.textContent = title;
      anchor.href = this.parts[idx].getLink();
      const li = document.createElement('li');
      li.appendChild(anchor);
      partsListDiv.appendChild(li);
    });

    // Setup UI event handling.
    this.shadowRoot.querySelectorAll('.remove-part').forEach(button => {
      button.onclick = _ => {
        const idx = parseInt(button.getAttribute('data-idx'));
        if (isNaN(idx)) {
          return;
        }
        this.removePart(idx);
      };
    });
    this.shadowRoot.querySelectorAll('.insert-part').forEach(button => {
      button.onclick = _ => {
        const link = prompt('Enter link of the song.');
        if (!link) {
          return;
        }
        const idx = parseInt(button.getAttribute('data-idx'));
        if (isNaN(idx)) {
          return;
        }
        this.insertPart(link, idx);
      };
    });
  }

  getLyricsString() {
    return fromLyricsToken(this.doc.lyricsTokens);
  }

  getNoteNumShift() {
    return this.noteNumShift;
  }
  incrNoteNumShift() {
    this.noteNumShift += 12;
    return this.getNoteNumShift();
  }

  decrNoteNumShift() {
    this.noteNumShift -= 12;
    return this.getNoteNumShift();
  }

  insertChord(chordStr) {
    if (!this.isChordMode()) {
      return false;
    }
    let chordObj;
    try {
      chordObj = new chd.Chord(Parser.parse(chordStr));
    } catch(err) {
      console.warn('failed to parse chord: ', chordStr, err);
      this.ebanner.display('failed to parse chord: ' + chordStr);
      return false;
    }
    const start = this.getCursorTime();
    const chordLoc = new ChordLoc(chordObj, start);
    this._insertChordLoc(chordLoc);
    return true;
  }

  _insertChordLoc(loc) {
    const upsertInfo = findUpsertIdx(this.doc.chordLocs, loc.start);
    this.doc.chordLocs.splice(upsertInfo.idx, upsertInfo.update ? 1 : 0, loc);
  }

  _insertKeySigLoc(loc) {
    const upsertInfo = findUpsertIdx(this.doc.keySigLocs, loc.start);
    this.doc.keySigLocs.splice(upsertInfo.idx, upsertInfo.update ? 1 : 0, loc);
    // TODO de-duplicate repeating key sigs (A, [A, A, B, B, A]) -> (A, [B, A])
  }

  getSelectedChord() {
    const upsertInfo = findUpsertIdx(this.doc.chordLocs, this.getCursorTime());
    if (!upsertInfo.update) {
      return null;
    }
    return this.doc.chordLocs[upsertInfo.idx].chord;
  }

  removeChord() {
    if (!this.isChordMode()) {
      return;
    }
    const start = this.getCursorTime();
    const upsertInfo = findUpsertIdx(this.doc.chordLocs, start);
    if (!upsertInfo.update) {
      this.navLeft();
      return;
    }
    this.doc.chordLocs.splice(upsertInfo.idx, 1);
  }

  isChordMode() {
    return this.editor.cursorOnChords;
  }

  enableChordMode() {
    const currTime = this.getCursorTime();
    this.editor.cursorOnChords = true;
    this._alignTime(currTime);
  }

  disableChordMode() {
    this.editor.cursorOnChords = false;
  }

  getCurrVoice() {
    if (this.isChordMode()) {
      return;
    }
    return this.doc.voices[this.editor.currVoiceIdx];
  }

  getCursorTime() {
    return this.editor.cursorTime;
  }

  incrSeed() {
    this.seed += 1;
    return this.seed
  }

  decrSeed() {
    this.seed -= 1;
    return this.seed
  }

  getKeySig() {
    return this.doc.keySigSp;
  }

  setKeySigFromStr(chordStr) {
    const chord = _parseChordStr(chordStr, this.ebanner);
    if (!chord) {
      return;
    }
    const currTime = this.getCursorTime();
    if (currTime.equals(this.doc.pickup.negative())) {
      this.doc.keySigSp = chord.root;
      return;
    }
    this._insertKeySigLoc(new KeySigLoc(chord.root, currTime));
  }

  shiftToKey(chordStr, shiftUp) {
    const chord = _parseChordStr(chordStr, this.ebanner);
    if (!chord) {
      return;
    }
    const newKeySp = chord.root;
    this.doc.shiftToKey(newKeySp, shiftUp);

    if (!this.viewMode) {
      // 1. Transpose for write mode should not persist
      // the transpose in the URL.
      return;
    }
    // 2. Transpose for view mode.
    // Persist the transpose to the URL for use in parts aggregation.
    const newUrl = new URL(document.URL);
    newUrl.searchParams.set('keySig', newKeySp.toString());
    newUrl.searchParams.set('shiftUp', shiftUp);
    window.history.pushState({}, '', newUrl.href);
  }

  insertSpace() {
    this.cut();
    this.upsertWithoutDur([null]);
    const cursorTime = this.getCursorTime();
    this.paste();
    this.setCursorTimeSyncPointer(cursorTime, true);
  }

  deleteSpace() {
    this.cut();
    this.shortenPrevNoteGp();
    const cursorTime = this.getCursorTime();
    this.paste();
    this.setCursorTimeSyncPointer(cursorTime, true);
  }

  incrPickup() {
    const change = frac.build(1, this.doc.timeSigDenom);
    this.setPickup(this.doc.pickup.plus(change));
  }

  decrPickup() {
    const change = frac.build(-1, this.doc.timeSigDenom);
    this.setPickup(this.doc.pickup.plus(change));
  }

  setPickupFromBeat(beats) {
    const newPickup = frac.build(beats, this.doc.timeSigDenom);
    this.setPickup(newPickup);
  }

  setPickup(newPickup) {
    if (newPickup.toFloat() < 0) {
      return;
    }
    const oldPickup = this.doc.pickup;
    const change = frac.Frac.minus(newPickup, oldPickup);
    this.doc.pickup = newPickup;

    this.doc.voices.forEach(voice => {
      voice.noteGps.toArray().forEach(noteGp => {
        noteGp.start = frac.Frac.minus(noteGp.start, change);
        noteGp.end = frac.Frac.minus(noteGp.end, change);
      });
    });
    // Sync the time.
    this.navHead();
  }

  deleteDoc() {
    const db = firebase.firestore();
    const collName = debug.version();
    db.collection(collName).doc(this.urlId).delete().then(_ => {
      const homeUrl = new URL('/fire/', (new URL(document.URL)).origin);
      const currUser = firebase.auth().currentUser;
      if (currUser) {
        homeUrl.searchParams.set('owner', currUser.email);
      }
      window.location.href =homeUrl.href;
    }).catch(error => {
      this.ebanner.slowDisplay("Error removing document: " + error.message);
      console.error("Error removing document: ", error);
    });
  }

  toggleShowSpelling() {
    this.showSpelling = !this.showSpelling;
  }

  setTempo(tempo) {
    this.doc.tempo = tempo;
  }

  getTempo() {
    return this.doc.tempo;
  }

  // TODO handle compound time sig.
  incrStep() {
    this.editor.step = this.editor.step.times(frac.build(2));
    return this.editor.step.toString();
  }

  decrStep() {
    this.editor.step = this.editor.step.over(frac.build(2));
    return this.editor.step.toString();
  }

  // Args:
  //   noteNums: [] means lengthen and [null] means add a rest.
  upsertWithoutDur(noteNums, startMillis) {
    const step = this.editor.step.over(frac.build(2));
    let duration = step;

    const currNoteGp = this.getCurrVoice().noteGps.getCurr();

    // For grace note, we need to get rid of the existing grace note first.
    if (currNoteGp && currNoteGp.isGraceNote()) {
      this.navRight();
      this.unsafeRemoveFromNoteGps();
    }

    if (currNoteGp) {
      if (currNoteGp.isRest() && currNoteGp.getDuration().geq(step)) {
        const split = this.tupletSplit(currNoteGp);
        if (split.length > 0) {
          const firstInSplit = split[0];
          // Either tied to a tuplet or is a single tuplet.
          if (split.length > 1 || chunking.isPossibleTuplet(firstInSplit)) {
            duration = firstInSplit.end.minus(currNoteGp.start);
          }
        }
      } else {
        duration = currNoteGp.end.minus(currNoteGp.start);
      }
    }
    this.upsertByDur(noteNums, duration, startMillis);
  }

  // Otherwise lengthen it from start to start of notes.
  lengthenPrevBy(dur) {
    this.lengthenPrevNoteGp(this.getCursorTime().plus(dur));
  }

  // Lengthen previous noteGp.end to newEnd.
  // Works even when out-of-sync.
  lengthenPrevNoteGp(newEnd) {
    this._surger();
    const noteGps = this.getCurrVoice().noteGps;

    while (noteGps.getCurr() && noteGps.getCurr().start.lessThan(newEnd)) {
      this.skipRight();
      this.unsafeRemoveFromNoteGps();
    }

    const left = noteGps.getLeft();
    if (left) {
      left.end = newEnd;
      if (noteGps.getCurr() && noteGps.getCurr().start.greaterThan(newEnd)) {
        this.addRestInGap(newEnd, noteGps.getCurr().start);
      }
    } else {
      // If at head, just insert a rest instead of lengthening.
      const restEnd = noteGps.getCurr() ? noteGps.getCurr().start : newEnd;
      this.addRestInGap(this.startTime(), restEnd);
    }
    this.setCursorTimeSyncPointer(newEnd);
  }

  _surger() {
    if (!this._isOutOfSync()) {
      return;
    }
    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    if (!curr) {
      // This should never happen if out-of-sync.
      return;
    }
    const oldCursorTime = this.getCursorTime();
    const [left, right] = curr.split(oldCursorTime);
    this.skipRight();
    this.unsafeRemoveFromNoteGps();
    this.unsafeAddToNoteGps(left);
    this.unsafeAddToNoteGps(right);
    this.setCursorTimeSyncPointer(oldCursorTime);
  }

  // Lowest level method for adding note group safely.
  // Works even when out-of-sync.
  _upsertNoteGp(noteGp) {
    this._surger();
    const noteGps = this.getCurrVoice().noteGps
    const newEnd = noteGp.end;

    while (noteGps.getCurr() && noteGps.getCurr().start.lessThan(newEnd)) {
      this.skipRight();
      this.unsafeRemoveFromNoteGps();
    }

    if (!noteGp.isRest()) {
      this.unsafeAddToNoteGps(noteGp);
      if (noteGps.getCurr() && noteGps.getCurr().start.greaterThan(newEnd)) {
        this.addRestInGap(newEnd, noteGps.getCurr().start);
      }
    } else {
      const restEnd = noteGps.getCurr() ? noteGps.getCurr().start : newEnd;
      this.addRestInGap(noteGp.start, restEnd);
    }
    this.setCursorTimeSyncPointer(newEnd);
  }

  toggleDisplayMelodyOnly() {
    this.doc.displayMelodyOnly = !this.doc.displayMelodyOnly;
  }
  toggleDisplayLyrics() {
    this.doc.displayLyrics = !this.doc.displayLyrics;
  }

  insertGraceNote() {
    if (this.isChordMode()) {
      return;
    }
    const noteStartAndEnd = this.getCursorTime();
    this.unsafeAddToNoteGps(new NoteGp([new Note(60)], noteStartAndEnd, noteStartAndEnd));
    this.navLeft();
  }

  // TODO remove hasTie
  upsertByDur(noteNums, duration, startMillis) {
    if (this.isChordMode()) {
      return;
    }

    const notes = noteNums.map(num => {
      return new Note(num);
    });
    const noteStart = this.getCursorTime();
    const noteEnd = noteStart.plus(duration);

    if (notes.length == 0) {
      this.lengthenPrevNoteGp(noteEnd);
      return;
    }
    this._upsertNoteGp(new NoteGp(notes, noteStart, noteEnd, false, startMillis));
  }

  // relNotes is a list of beat.Note (must have start time relative to start beat)
  upsertBeat(relNotes, step) {
    if (this.isChordMode()) {
      return;
    }

    step = step || this.editor.step;
    const noteGps = this.getCurrVoice().noteGps;
    const cursorStart = this.getCursorTime();
    const beatStartTime = cursorStart.over(step).wholePart().times(step);
    const beatEndTime = beatStartTime.plus(step);

    function relativeToAbsolute(time) {
      return beatStartTime.plus(time.times(step));
    }
    const newNoteGpsArrWithGraceNotes = relNotes.map((relNote, i) => {
      let noteEnd = beatEndTime;
      if (i + 1 < relNotes.length) {
        const relEnd = relNotes[i + 1].start;
        noteEnd = relativeToAbsolute(relEnd);
      }
      const noteStart = relativeToAbsolute(relNote.start);
      return new NoteGp(
        relNote.noteNums.map(noteNum => {
          return new Note(noteNum);
        }), noteStart, noteEnd);
    });

    // 0. Treat grace notes as simultaneous notes.
    const newNoteGpsArr = collapseGraceNotesToSimultaneousNotes(newNoteGpsArrWithGraceNotes);

    // 1. Gather enough notes from the left for merging.
    const noteGpsLeftOfCursor = [];
    while (true) {
      const left = noteGps.getLeft();
      if (!left) {
        break;
      }
      // Want noteGpsLeftOfCursor.length > 0 in order to extend the previous
      // beat's noteGp if possible
      if (left.end.equals(beatStartTime) && noteGpsLeftOfCursor.length > 0) {
        break;
      }
      if (left.end.lessThan(beatStartTime)) {
        break;
      }
      // left.end > beatStartTime
      noteGpsLeftOfCursor.push(left);
      this.unsafeRemoveFromNoteGps();
    }
    noteGpsLeftOfCursor.reverse();

    // 2. Merge and upsert
    function merge(noteGpsLeftOfCursor, newNoteGpsArr) {
      const res = [];
      const newNoteGpsStart = (
        newNoteGpsArr.length === 0 ?
        beatEndTime :
        newNoteGpsArr[0].start
      );

      res.push(...noteGpsLeftOfCursor.filter(noteGp => {
        // Strictness of lessThan removes grace notes as well.
        return noteGp.start.lessThan(newNoteGpsStart);
      }));
      if (res.length > 0) {
        // Ensure that noteGpsLeftOfCursor and newNoteGpsArr have no gaps in between.
        res[res.length - 1].end = newNoteGpsStart;
      } else {
        // Ensure that beatStartTime and newNoteGpsStart have no gaps in between.
        if (beatStartTime.lessThan(newNoteGpsStart)) {
          res.push(new NoteGp(
            [new Note(null)], beatStartTime, newNoteGpsStart));
        }
      }
      res.push(...newNoteGpsArr);
      return res;
    }
    merge(noteGpsLeftOfCursor, newNoteGpsArr).forEach(noteGp => {
      this._upsertNoteGp(noteGp);
    });
  }

  // Shorten the left note group by a step.
  // Works for out-of-sync.
  shortenPrevNoteGp() {
    if (this.isChordMode()) {
      return;
    }
    this._surger()
    const step = this.editor.step.over(frac.build(2));
    const noteGps = this.getCurrVoice().noteGps;
    const left = noteGps.getLeft();
    if (noteGps.atHead() || !left) {
      // At head; don't do anything.
      return;
    }
    const cursorTime = this.getCursorTime();
    const prevBeat = location.computePrevBeat(cursorTime, step);

    let newTime = prevBeat.lessThan(left.start) ? left.start : prevBeat;
    let addRest = false;
    const split = this.tupletSplit(left);
    if (split.length > 0) {
      const lastInSplit = split[split.length - 1];
      // Either tied to a tuplet or is a single tuplet.
      if (chunking.isPossibleTuplet(lastInSplit)) {
        newTime = lastInSplit.start;
        addRest = chunking.isPossibleTuplet(lastInSplit);
      } else {
        newTime = prevBeat.lessThan(lastInSplit.start) ? lastInSplit.start : prevBeat;
      }
    }
    // For rest not at the tail, shorten just means moving the cursor leftward.
    this.shortenPrevTo(newTime, addRest);
  }

  tupletSplit(currNoteGp) {
    if (currNoteGp.isGraceNote()) {
      return [currNoteGp];
    }
    const res = [];
    const chunks = chunking.tupletChunking(chunking.toChunks(
      this.getCurrVoice().noteGps.toArray()));
    let started = false;
    let ended = false;
    chunks.forEach(chunk => {
      chunk.getNoteGps().forEach(noteGp => {
        if (noteGp.start.equals(currNoteGp.start)) {
          started = true;
        }
        if (noteGp.end.greaterThan(currNoteGp.end)) {
          ended = true;
        }
        if (started && !ended) {
          if (!noteGp.isGraceNote()) {
            res.push(noteGp);
          }
        }
      });
    });
    return res;
  }
  // Also handle inserting rests.
  shortenPrevTo(newTime, addRest) {
    const noteGps = this.getCurrVoice().noteGps;
    const left = noteGps.getLeft();
    if (!left) {
      return;
    }
    const currTime = left.end;
    if (left.start.equals(newTime)) {
      this.unsafeRemoveFromNoteGps();
    } else if (left.start.lessThan(newTime)) {
      left.end = newTime;
    } else {
      console.warn('Invalid newTime', newTime, left);
    }

    if (noteGps.atTail() && !addRest) {
      this.setCursorTimeSyncPointer(newTime);
    } else {
      // Insert a rest to the right.
      this.addRestInGap(newTime, currTime);
      this.setCursorTimeSyncPointer(newTime);
    }
  }

  // There may or may not be something to the right of the gap.
  // The cursor will point to end.
  addRestInGap(start, end) {
    if (start.geq(end)) {
      this.setCursorTimeSyncPointer(end);
      return;
    }
    const noteGps = this.getCurrVoice().noteGps;
    const right = noteGps.getCurr();
    const left = noteGps.getLeft();
    if (right && right.isRest()) {
      if (left && left.isRest()) {
        this.unsafeRemoveFromNoteGps();
        right.start = left.start;
      } else {
        right.start = start;
      }
    } else {
      if (left && left.isRest()) {
        this.unsafeRemoveFromNoteGps();
        this.unsafeAddToNoteGps(new NoteGp([new Note(null)], left.start, end));
      } else {
        this.unsafeAddToNoteGps(new NoteGp([new Note(null)], start, end));
      }
    }
    this.setCursorTimeSyncPointer(end);
  }

  deletePrevMeasure() {
    this.shortenPrevNoteGp();
    while (!this.atStartOfMeasure() && !this.getCurrVoice().noteGps.atHead()) {
      this.shortenPrevNoteGp();
    }
  }

  atStartOfMeasure() {
    return this.getCursorTime().over(this.getDurationPerMeasure()).isWhole();
  }

  startTime() {
    return this.doc.pickup.negative();
  }

  // If there is a gap between left and current noteGp,
  // this return the current noteGp.start.
  _currPointerTime() {
    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    const left = noteGps.getLeft();
    if (!curr && !left) {
      return this.startTime();
    }
    return curr ? curr.start : left.end;
  }

  // START of mutable noteGps method calls.
  // Purpose: calling mutable methods on noteGps causes the time and pointer
  // to go out-of-sync; thus whenever those methods are called, we need
  // to sync the cursor time to the new pointer position.
  _syncTimeToPointer() {
    this.setCursorTimeSyncPointer(this._currPointerTime());
  }

  // leftMost: if true, when cursorTime points to multiple notes
  // (due to grace notes) go to the leftMost one. If false, the
  // cursor will stay at the first note with the correct start.
  setCursorTimeSyncPointer(cursorTime, leftMost) {
    this.editor.cursorTime = cursorTime;
    if (this.isChordMode()) {
      return;
    }

    // 1. Sync pointer
    const noteGps = this.getCurrVoice().noteGps;
    // The order of the 2 while loops makes it so that
    // pointer is never to the right of cursorTime.
    while (this._currPointerTime().lessThan(cursorTime)) {
      const moved = noteGps.moveRight();
      if (!moved) {
        break;
      }
    }
    while (this._currPointerTime().greaterThan(cursorTime)) {
      const moved = noteGps.moveLeft();
      if (!moved) {
        break;
      }
    }

    if (leftMost) {
      while (noteGps.getLeft() && noteGps.getLeft().isGraceNote()) {
        const moved = noteGps.moveLeft();
        if (!moved) {
          break;
        }
      }
    }

    // 2. Validate
    if (this._currPointerTime().equals(cursorTime)) {
      return;
    }
    const curr = noteGps.getCurr();
    // Allow cursorTime differ from pointer if cursorTime is within
    // the pointer's rest note.
    if (curr && curr.isRest() && cursorTime.strictlyInside(curr.start, curr.end)) {
      return;
    }

    console.warn(
      'setCursorTimeSyncPointer with a bad cursorTime.',
      this.getCursorTime(),
      this.getCurrVoice().noteGps.getCurr());
    // TODO remove this because having a method that sync in both directions
    // is confusing.
    // this._syncTimeToPointer();
  }

  // Only safe if adding at the end or for filling a gap
  unsafeAddToNoteGps(item) {
    const noteGps = this.getCurrVoice().noteGps;
    noteGps.add(item);
    this._syncTimeToPointer();
  }

  // Safe only if removing at the end or if you call
  // unsafeAddToNoteGps afterward to fill the gap.
  unsafeRemoveFromNoteGps() {
    const noteGps = this.getCurrVoice().noteGps;
    noteGps.remove();
    this._syncTimeToPointer();
  }
  // END of mutable noteGps method calls.

  navHead() {
    this.setCursorTimeSyncPointer(this.doc.pickup.negative(), true);
  }

  navTail() {
    let cursorTime = this.doc.pickup.negative();
    if (this.isChordMode()) {
      if (this.doc.chordLocs.length === 0) {
        return;
      }
      cursorTime = this.doc.chordLocs[this.doc.chordLocs.length - 1].start;
    } else {
      const noteGpsArr = this.getCurrVoice().noteGps.toArray();
      if (noteGpsArr.length == 0) {
        return;
      }
      cursorTime = noteGpsArr[noteGpsArr.length - 1].end;
    }
    this.setCursorTimeSyncPointer(cursorTime);
  }

  navUp() {
    const barsPerLine = 4;
    math.range(0, barsPerLine).forEach(_ => {
      this.navLeftMeasure();
    });
  }

  navDown() {
    let barsPerLine = 4;
    if (this.getCursorTime().lessThan(frac.build(0))) {
      barsPerLine = 5;
    }
    math.range(0, barsPerLine).forEach(_ => {
      this.navRightMeasure();
    });
  }

  atHead() {
    const atStartTime = this.getCursorTime().equals(this.startTime());
    if (this.isChordMode()) {
      return atStartTime;
    }
    return atStartTime && this.getCurrVoice().noteGps.atHead();
  }

  atTail() {
    if (this.isChordMode()) {
      return false;
    }
    return this.getCurrVoice().noteGps.atTail();
  }

  // Move to "the start" of a measure that is earlier than the cursor position.
  // "the start" may be inside the measure if the measure has a note tied from
  // the previous measure.
  navLeftMeasure() {
    const durationPerMeasure = this.getDurationPerMeasure();
    const startMeasNum = location.measureNum(this.getCursorTime(), durationPerMeasure);
    const measStartTime = location.measureNumToTime(startMeasNum, durationPerMeasure, this.doc.pickup);
    const prevMeasStartTime = location.measureNumToTime(startMeasNum > 0 ? startMeasNum - 1 : 0, durationPerMeasure, this.doc.pickup);
    const strictlyInCurrMeas = measStartTime.lessThan(this.getCursorTime());

    // chord cursor to need to be handled specially to make it not fall between beats.
    if (this.isChordMode()) {
      if (strictlyInCurrMeas) {
        this.setCursorTimeSyncPointer(measStartTime);
      } else {
        this.setCursorTimeSyncPointer(prevMeasStartTime);
      }
      return;
    }

    let expectedMeasNumDiff = strictlyInCurrMeas ? 0 : 1;
    let numNavLeft = 0;
    while (!this.atHead()) {
      this.navLeft();
      numNavLeft += 1;
      const currMeasNum = location.measureNum(this.getCursorTime(), durationPerMeasure);

      // For some cases, we only know expectedMeasNumDiff after moving left once.
      // e.g. strictlyInCurrMeas is true for | c d- | d ? e |, but
      // expectedMeasNumDiff is 1 in order to result in | ? c d- | d e |
      if (numNavLeft == 1) {
        if (startMeasNum - currMeasNum > 0) {
          expectedMeasNumDiff = startMeasNum - currMeasNum;
        }
      }

      if (startMeasNum - currMeasNum > expectedMeasNumDiff) {
        if (numNavLeft > 1) {
          // | c d | d ? e | overshoots to | c ? d | d e | so navRight
          // to get back to | c d | ? d e |.
          this.navRight();
        }
        return;
      }
    }

  }

  navRightMeasure() {
    const durationPerMeasure = this.getDurationPerMeasure();
    const startMeasNum = location.measureNum(this.getCursorTime(), durationPerMeasure);

    // chord cursor to need to be handled specially to make it not fall between beats.
    if (this.isChordMode()) {
      const nextMeasStartTime = location.measureNumToTime(startMeasNum + 1, durationPerMeasure, this.doc.pickup);
      this.setCursorTimeSyncPointer(nextMeasStartTime);
      return;
    }

    while (!this.atTail()) {
      this.navRight();
      const currMeasNum = location.measureNum(this.getCursorTime(), durationPerMeasure);
      if (Math.abs(startMeasNum - currMeasNum) >= 1) {
        return;
      }
    }
  }

  // TODO consider implementing navPrev as well.
  navLeft() {
    if (this.isChordMode()) {
      this.setCursorTimeSyncPointer(this._prevCursorTime());
      return;
    }

    const noteGps = this.getCurrVoice().noteGps;
    const left = noteGps.getLeft();
    if (left && left.isGraceNote()) {
      // Handle grace notes differently because sync only
      // move pointer to non-grace notes.
      noteGps.moveLeft();
      return;
    }
    if (this.atHead()) {
      return;
    }
    this.setCursorTimeSyncPointer(this._prevCursorTime());
  }

  navRight() {
    if (this.isChordMode()) {
      this.setCursorTimeSyncPointer(this._nextCursorTime(), true);
      return;
    }

    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    if (curr && curr.isGraceNote()) {
      noteGps.moveRight();
      return;
    }
    this.setCursorTimeSyncPointer(this._nextCursorTime(), true);
  }

  // Go to the end of the current note even if it is a rest note.
  skipRight() {
    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    if (curr && curr.isRest()) {
      this.setCursorTimeSyncPointer(curr.end);
      return;
    }
    this.navRight();
  }

  _nextCursorTime() {
    const cursorTime = this.getCursorTime();
    if (this.isChordMode()) {
      return cursorTime.plus(this.editor.step);
    }
    const step = this.editor.step.over(frac.build(2));
    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    if (curr) {
      if (curr.isRest()) {
        const newCursorTime = cursorTime.plus(step);
        return curr.end.lessThan(newCursorTime) ? curr.end : newCursorTime;
      }
      return curr.end;
    }
    return cursorTime;
  }

  _prevCursorTime() {
    const cursorTime = this.getCursorTime();
    if (this.isChordMode()) {
      const newCursorTime = cursorTime.minus(this.editor.step);
      if (newCursorTime.lessThan(this.startTime())) {
        return this.startTime();
      }
      return newCursorTime
    }
    const step = this.editor.step.over(frac.build(2));
    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    if (this._isOutOfSync()) {
      const newCursorTime = cursorTime.minus(step);
      return curr.start.lessThan(newCursorTime) ? newCursorTime : curr.start;
    }
    const left = noteGps.getLeft();
    if (left) {
      if (!left.isRest()) {
        return left.start;
      }
      const newCursorTime = cursorTime.minus(step);
      return left.start.lessThan(newCursorTime) ? newCursorTime : left.start;
    }
    return this.startTime();
  }

  // The pointer can be left of the cursorTime for rest notes,
  // in which case it is out-of-sync.
  _isOutOfSync() {
    const noteGps = this.getCurrVoice().noteGps;
    const curr = noteGps.getCurr();
    return curr && curr.start.lessThan(this.getCursorTime());
  }

  save(clone, onSuccess) {
    const currUser = firebase.auth().currentUser;
    if (!currUser) {
      alert('Sign in to save.');
      return;
    }

    if (this.doc.owner && this.doc.owner !== currUser.email) {
      clone = true;
    }
    if (clone) {
      // It's okay to modify the doc, because we won't save it.
      this.doc.cloneId = this.urlId;
    }

    this.doc.owner = currUser.email;

    const db = firebase.firestore();
    const collName = debug.version();
    const id = clone ? (new Date).toISOString().replace(/:/g,'_') : this.urlId;
    db.collection(collName).doc(id).set({
      id: id,
      title: this.doc.title,
      composer: this.doc.composer,
      payload: this.serialize(),
      owner: this.doc.owner,
      hasParts: this.parts.length > 0,
      lastEdit: Date.now(),
    }).then(_ => {
      if (onSuccess) {
        onSuccess();
        return;
      }
      if (clone) {
        window.location.href = getSongUrl(id);
      } else {
        this.ebanner.display('Saved.');
      }
    }).catch(err => {
      console.warn('Failed to save.', err);
      this.ebanner.display(err.message);
    });
  }

  addSimpleBass() {
    this._upsertComping(bassComp.simpleBass);
  }

  addTwoBeatBass() {
    this._upsertComping(bassComp.twoBeatBass);
  }

  addBossaNovaBass() {
    this._upsertComping(bassComp.bossaNovaBass);
  }
  addBossaNovaComping() {
    this._upsertComping(comp.bossaNovaComp);
  }
  // _genBassSeed(seed) {
  //   return Math.min(23, Math.max(36, Math.floor(Math.random() * 5) + seed - 2))
  // }

  // TODO refactor and get rid of n,n,n,n-n,n-n-n.
  addFingerStyleComping() {
    const quietFactor = 0.4;
    this._upsertComping((slot, prevSlot) => {
      let remainder = slot.duration;
      const chord = slot.chord;
      const bassSpelling = chord.getBassSpelling();
      const bassNoteNum = bassSpelling.toNoteNum(3) < 44 ? bassSpelling.toNoteNum(3) : bassSpelling.toNoteNum(2);
      const noteNums = chord.chordTonesAbove(bassNoteNum + chord.getFifthInterval());
      const skipBass = (
        prevSlot && prevSlot.chord &&
        prevSlot.duration.lessThan(frac.build(3, 4)) &&
        prevSlot.chord.getBassSpelling().toString() == bassSpelling.toString());
      const eighth = frac.build(1, 8);
      this.upsertByDur(skipBass ? noteNums.slice(2, 4) : [bassNoteNum], eighth);
      remainder = remainder.minus(eighth);

      const rand = Math.random();
      let dur1 = eighth;
      if (rand < 1/3 && eighth.lessThan(eighth)) {
        dur1 = eighth.times(frac.build(2));
      }
      if (Math.random() < quietFactor) {
        this.lengthenPrevBy(eighth);
      } else {
        this.upsertByDur([noteNums[0]], dur1);
      }
      remainder = remainder.minus(dur1);
      if (remainder.toFloat() <= 0) {
        return;
      }

      let dur2 = frac.build(1, 4).minus(dur1);
      const longSecondBeat = Math.random() < 0.4;
      if (remainder.equals(frac.build(1, 4)) && longSecondBeat) {
        dur2 = remainder;
      }

      const rand3 = Math.random();
      let notes1 = [noteNums[1]];
      const beatLike = rand3 < 1/3;
      let idx3 = 2;
      if (beatLike) {
        notes1 = [noteNums[1], noteNums[2]];
        idx3 = 0;
      }
      if (dur2.toFloat() > 0) {
        this.upsertByDur(notes1, dur2);
      }
      remainder = remainder.minus(dur2);
      if (remainder.toFloat() <= 0) {
        return;
      }

      if (remainder.leq(eighth)) {
        this.upsertByDur([noteNums[idx3]], remainder)
        return;
      }

      const rand4 = Math.random();
      let quiet = true;
      let dur3 = remainder;
      if (rand4 < 1/12) {
        dur3 = eighth;
      } else if (rand4 < 3/12) {
        dur3 = eighth.times(frac.build(2));
      } else if (rand4 < 7/12) {
        quiet = false;
      }
      if (beatLike || !quiet) {
        if (Math.random() < quietFactor) {
          this.lengthenPrevBy(eighth);
        } else {
          this.upsertByDur([noteNums[idx3]], eighth);
        }
        remainder = remainder.minus(eighth);
        const shifts = math.shuffle(math.range(0, 4));
        if (Math.random() < quietFactor) {
          this.lengthenPrevBy(eighth);
        } else {
          this.upsertByDur([noteNums[shifts[0]]], eighth);
        }
        remainder = remainder.minus(eighth);
        if (remainder.toFloat() <= 0) {
          return;
        }
        if (Math.random() < quietFactor) {
          this.lengthenPrevBy(eighth);
        } else {
          this.upsertByDur([noteNums[shifts[1]]], eighth);
        }
        remainder = remainder.minus(eighth);
        if (remainder.toFloat() <= 0) {
          return;
        }
        if (Math.random() < quietFactor) {
          this.lengthenPrevBy(eighth);
        } else {
          this.upsertByDur([noteNums[shifts[2]]], eighth);
        }
        remainder = remainder.minus(eighth);
        if (remainder.toFloat() <= 0) {
          return;
        }
        this.upsertByDur([noteNums[shifts[3]]], remainder);
        return;
      }

      this.upsertByDur([noteNums[idx3]], dur3);
      remainder = remainder.minus(dur3);
      if (remainder.toFloat() <= 0) {
        return;
      }
      const rand5 = Math.random();
      let dur4 = remainder;
      if (rand5 < 1/3) {
        dur4 = eighth;
      }
      const noteNums2 = chord.chordTonesAbove(noteNums[0] + 7);
      this.upsertByDur([noteNums2[1]], dur4);
      remainder = remainder.minus(dur4);
      if (remainder.toFloat() <= 0) {
        return;
      }
      const rand6 = Math.random();
      let idx9 = 0;
      if (rand6 < 1/3) {
        idx9 = 2;
      }
      this.upsertByDur([noteNums2[idx9]], remainder);
    });
  }

  addSimpleComping() {
    let simple = true;
    let seed = this.seed;
    this._upsertComping(slot => {
      const fourBeat = slot.duration.equals(frac.build(4, 4));
      if (simple) {
        simple = Math.random() < 0.4;
      } else if (fourBeat) {
        simple = Math.random() < 0.1;
      } else {
        simple = Math.random() < 0.3;
      }
      if (simple) {
        this._simpleComping(slot, seed);
        seed = this._genCompSeed(seed);
        return;
      }
      this._twoBeatComping(slot, seed);
      seed = this._genCompSeed(seed);
    });
  }

  addMelodicComping() {
    let seed = this.seed;
    this._upsertComping(slot => {
      this._melodicComping(slot, seed);
      seed = this._genCompSeed(seed);
    });
  }

  _melodicComping(slot, seed) {
    // const useColor = Math.random() < 0.3;

    let remainder = slot.duration;
    const notes0 = slot.chord.chordTonesAbove(seed - 12);

    let dur0 = frac.build(1, 4);
    let notes = [notes0[1]];
    const dur0Rand = Math.random();
    if (dur0Rand < 1 / 6 && remainder.geq(frac.build(1, 2))) {
      dur0 = frac.build(3, 8);
    } else if (dur0Rand < 3 / 6 && remainder.geq(frac.build(1, 2))) {
      dur0 = frac.build(1, 2);
      notes = [notes0[1], notes0[0]];
    }

    this.upsertByDur(notes, dur0);
    remainder = remainder.minus(dur0);
    if (remainder.toFloat() <= 0) {
      return;
    }

    const shiftIdxRand = Math.random();
    let shiftIdx1;
    let shiftIdx2;
    let shiftIdx3;
    if (shiftIdxRand < 1/10) {
      shiftIdx1 = 0;
      shiftIdx2 = 1;
      shiftIdx3 = 2;
    } else if (shiftIdxRand < 2/10) {
      shiftIdx1 = 0;
      shiftIdx2 = -1;
      shiftIdx3 = 1;
    } else if (shiftIdxRand < 4/10) {
      shiftIdx1 = -1;
      shiftIdx2 = 0;
      shiftIdx3 = 1;
    } else if (shiftIdxRand < 6/10) {
      shiftIdx1 = 1;
      shiftIdx2 = 0;
      shiftIdx3 = 2;
    } else if (shiftIdxRand < 8/10) {
      shiftIdx1 = 1;
      shiftIdx2 = 2;
      shiftIdx3 = 1;
    } else {
      shiftIdx1 = 2;
      shiftIdx2 = 1;
      shiftIdx3 = 0;
    }
    let dur1 = frac.build(1, 8);
    let notes1 = [notes0[1+shiftIdx1]];
    if (dur0.equals(frac.build(1, 2)) && Math.random() < 0.3) {
      dur1 = frac.build(1,2);
      notes1 = [notes0[1+shiftIdx1], notes0[shiftIdx1 <= -1 ? 2 : shiftIdx1]];
    } else if (remainder.geq(frac.build(1,4)) && Math.random() < 0.5) {
      dur1 = frac.build(1,4);
    }
    this.upsertByDur(notes1, dur1);
    remainder = remainder.minus(dur1);
    if (remainder.toFloat() <= 0) {
      return;
    }

    let dur2 = frac.build(1, 8);
    let notes2 = [notes0[1+shiftIdx2]];
    const dur2Rand = Math.random();
    if (dur2Rand < 2 / 4 && remainder.geq(frac.build(1, 4))) {
      dur2 = frac.build(1, 4);
      if (Math.random() < 0.2) {
        notes2 = [notes0[1+shiftIdx2], notes0[shiftIdx2 <= -1 ? 2 : shiftIdx2]];
      }
    } else if (dur2Rand < 3 / 4 && remainder.geq(frac.build(3, 8))) {
      dur2 = frac.build(3, 8);
      if (Math.random() < 0.4) {
        notes2 = [notes0[1+shiftIdx2], notes0[shiftIdx2 <= -1 ? 2 : shiftIdx2]];
      }
    }
    this.upsertByDur(notes2, dur2);
    remainder = remainder.minus(dur2);
    if (remainder.toFloat() <= 0) {
      return;
    }
    let notes3 = [notes0[1+shiftIdx3]];
    if (remainder.geq(frac.build(3, 8)) && Math.random() < 0.4) {
      notes3 = [notes0[1+shiftIdx3], notes0[shiftIdx3 <= -1 ? 2 : shiftIdx3]];
    }
    this.upsertByDur(notes3, remainder);
    // remainder = remainder.minus(dur2);
  }

  _genCompSeed(seed) {
    return Math.min(65, Math.max(45, Math.floor(Math.random() * 3) + seed - 1))
  }

  _simpleComping(slot, seed) {
    // TODO replace 54 (G4) with something less arbitrary, e.g. the top note from the previous chord voicing.
    const numNotes = Math.random() < 0.6 ? 2 : 1;
    const noteNums = slot.chord.chordTonesBelow(seed).slice(0, numNotes);
    this.upsertByDur(noteNums, slot.duration);
  }

  _twoBeatComping(slot, seed) {
    // TODO replace 54 (G4) with something less arbitrary, e.g. the top note from the previous chord voicing.
    let dur2 = frac.build(1, 8);
    const twoBeat = slot.duration.equals(frac.build(2, 4));
    if (twoBeat) {
      const rand = Math.random();
      if (rand < 1/3) {
        dur2 = frac.build(1, 8);
      } else {
        dur2 = frac.build(1, 4);
      }
    }
    const threeBeat = slot.duration.equals(frac.build(3, 4));
    if (threeBeat) {
      const rand = Math.random();
      if (rand < 1/4) {
        dur2 = frac.build(1, 8);
      } else if (rand < 2/4) {
        dur2 = frac.build(1, 4);
      } else if (rand < 3/4) {
        dur2 = frac.build(3, 8);
      } else {
        dur2 = frac.build(2, 4);
      }
    }
    const fourBeat = slot.duration.equals(frac.build(4, 4));
    if (fourBeat) {
      const rand = Math.random();
      if (rand < 3/8) {
        dur2 = frac.build(1, 4);
      } else if (rand < 5/8) {
        dur2 = frac.build(3, 8);
      } else {
        dur2 = frac.build(2, 4);
      }
    }

    const dur1 = slot.duration.minus(dur2);
    if (dur1.toFloat <= 0) {
      throw 'too small to generate 2 beat comping';
    }
    seed = seed || 54;
    const halfNote = frac.build(2, 4);
    const below = slot.chord.chordTonesBelow(seed + 3);
    const idx1 = Math.floor(Math.random() * (below.length - 1));
    let notes1 = [below[idx1]];
    if (Math.random() < 0.3) {
      notes1 = [below[idx1], below[idx1 + 1]];
    }
    if (halfNote.lessThan(dur1)) {
      this.upsertByDur(notes1, halfNote.plus(dur1.minus(halfNote)));
    } else {
      this.upsertByDur(notes1, dur1);
    }

    let idx2 = Math.floor(Math.random() * (below.length - 1));
    if (idx1 === idx2) {
      idx2 = Math.floor(Math.random() * (below.length - 1));
      if (idx1 === idx2) {
        idx2 = Math.floor(Math.random() * (below.length - 1));
      }
    }
    let notes2 = [below[idx2]];
    if (Math.random() < 0.2) {
      notes2 = [below[idx2], below[idx2 + 1]];
    }
    this.upsertByDur(notes2, dur2);
  }

  _oneBeatComping(slot, skipSecondHalf, seed, decorate) {
    const halfBeat = frac.build(1, 8);
    if (skipSecondHalf) {
      this.upsertByDur(slot.chord.chordTonesBelow(seed).slice(0, 2), halfBeat.times(frac.build(2)));
      return;
    }
    if (!decorate) {
      this.upsertByDur(slot.chord.chordTonesBelow(seed).slice(0, 2), halfBeat);
      this.upsertByDur(slot.chord.chordTonesBelow(seed).slice(2, 3), halfBeat);
      return;
    }
    const quarterBeat = frac.build(1, 16);
    let halfBeatIdx;
    const rand = Math.random();
    if (rand < 0.65) {
      halfBeatIdx = 0;
    } else if (rand < 0.93) {
      halfBeatIdx = 1;
    } else {
      halfBeatIdx = 2;
    }
    const durations = [quarterBeat, quarterBeat];
    durations.splice(halfBeatIdx, 0, halfBeat);
    const notes = [
      slot.chord.chordTonesBelow(seed).slice(2, 3),
      slot.chord.chordTonesBelow(seed).slice(3, 4)];
    math.shuffle(notes);
    this.upsertByDur(slot.chord.chordTonesBelow(seed).slice(0, 2), durations[0]);
    this.upsertByDur(notes[0], durations[1]);
    this.upsertByDur(notes[1], durations[2]);
  }

  addOneBeatComping() {
    let seed = 54;
    this._upsertComping(slot => {
      if (!slot.duration.times(frac.build(4)).isWhole()) {
        throw 'Unable to add one beat comping for this time sig.'
      }
      const numBeats = slot.duration.times(frac.build(4)).toFloat();

      const skipNum = Math.floor(Math.random() * numBeats);
      math.range(0, numBeats).forEach(idx => {
        let decorate = false;
        if (idx >= Math.floor(numBeats / 2)) {
          decorate = Math.random() < .15 * (idx / 1.5 + 1);
        }
        this._oneBeatComping(slot, skipNum === idx && idx !== 1, seed, decorate);
      });
      seed = this._genCompSeed(seed);
    });
  }

  addDecoratedTwoBeatComping() {
    this._upsertComping(slot => {
      // TODO replace 54 (G4) with something less arbitrary, e.g. the top note from the previous chord voicing.
      if (slot.duration.lessThan(frac.build(2, 4))) {
        this._twoBeatComping(slot);
        return;
      }
      const dur2 = frac.build(1, 8);
      let dur1 = slot.duration.over(frac.build(2));
      if (slot.duration.equals(frac.build(3, 4))) {
        dur1 = frac.build(2, 4);
      }
      dur1 = dur1.minus(dur2);
      const dur3 = slot.duration.minus(dur1).minus(dur2);
      this.upsertByDur(slot.chord.chordTonesBelow(54).slice(0, 2), dur1);
      this.upsertByDur(slot.chord.chordTonesBelow(54).slice(2, 3), dur2);
      this.upsertByDur(slot.chord.chordTonesBelow(54).slice(1, 2), dur3);
    });
  }

  _createChordSlots() {
    const finalEndTime = this._getMaxEndTime();
    const durationPerMeasure = this.getDurationPerMeasure();
    const chordLocs = this.doc.chordLocs;
    const slots = [];
    if (this.doc.pickup.toFloat() > 0) {
      slots.push({
        chord: null,
        duration: this.doc.pickup,
        start: this.doc.pickup.negative(),
        end: frac.build(0),
      });
    }
    chordLocs.forEach((chordLoc, idx) => {
      const chord = chordLoc.chord;
      const startTime = chordLoc.start;
      const endTime = idx + 1 < chordLocs.length ? chordLocs[idx + 1].start : finalEndTime;
      _split(startTime, endTime, durationPerMeasure).forEach(splitRes => {
        const duration = splitRes.end.minus(splitRes.start);
        slots.push({
          chord: chord,
          duration: duration,
          start: splitRes.start,
          end: splitRes.end,
        });
      });
    });
    return slots;
  }

  _upsertComping(algo) {
    const onlyAddToCursorSlot = !this.getCurrVoice().noteGps.atTail();
    const currTime = this.getCursorTime();
    let shouldAdd = false;
    const slots = this._createChordSlots();
    slots.forEach((slot, idx) => {
      if (currTime.equals(slot.start)) {
        shouldAdd = true;
      } else {
        if (onlyAddToCursorSlot) {
          shouldAdd = false;
        }
      }
      if (!shouldAdd) {
        return;
      }

      // Deal with pickup measure.
      if (!slot.chord) {
        this.upsertByDur([null], slot.duration);
        return;
      }
      const res = algo(slot, idx > 0 ? slots[idx - 1] : null);
      if (res) {
        // Each beat/step is multiplied by slot.duration, so we need to scale
        // down relNote.start by dividing by slot.duration.
        this.upsertBeat(res.map(relNote => {
          const res = relNote.clone();
          res.start = relNote.start.over(slot.duration);
          return res;
        }), slot.duration);
      }
    });
  }

  _getMaxEndTime() {
    let poss = this.doc.pickup.negative();
    this.doc.voices.forEach(voice => {
      const finalNoteGp = voice.noteGps.get2ndLast();
      if (finalNoteGp && poss.lessThan(finalNoteGp.end)) {
        poss = finalNoteGp.end;
      }
    });
    if (this.doc.chordLocs.length > 0) {
      const finalChordLoc = this.doc.chordLocs[this.doc.chordLocs.length - 1];
      const lastChordEnd = location.nextMeasureTime(finalChordLoc.start, this.getDurationPerMeasure());
      if (poss.lessThan(lastChordEnd)) {
        poss = lastChordEnd
      }
    }
    return poss;
  }

  getDurationPerMeasure() {
    return frac.build(this.doc.timeSigNumer, this.doc.timeSigDenom);
  }

  incrTimeSigNumer() {
    this.doc.timeSigNumer += 1;
  }

  decrTimeSigNumer() {
    if (this.doc.timeSigNumer <= 1) {
      return;
    }
    this.doc.timeSigNumer -= 1;
  }

  incrTimeSigDenom() {
    this.doc.timeSigDenom *= 2;
  }

  decrTimeSigDenom() {
    this.doc.timeSigDenom /= 2;
  }

  setTitle(title) {
    this.doc.title = title;
  }

  getTitle() {
    return this.doc.title;
  }

  // oldCurrTime arg is needed because we may have removed the voice before
  // calling this method.
  _setVoiceIdxAndAlign(idx, oldCurrTime) {
    oldCurrTime = oldCurrTime || this.getCursorTime();
    this.editor.currVoiceIdx = idx;
    this._alignTime(oldCurrTime);
  }

  setVoiceIdx(idx) {
    this.editor.currVoiceIdx = idx;
  }

  goUp() {
    if (this.isChordMode()) {
      const measNum = location.measureNum(this.getCursorTime(), this.getDurationPerMeasure());
      const barsPerLine = 4;
      const lineNum = location.lineNum(measNum, barsPerLine);
      this.navUp();
      if (lineNum === 0) {
        return;
      }
      const currTime = this.getCursorTime();
      this.disableChordMode();
      this._setVoiceIdxAndAlign(this.doc.voices.length - 1, currTime);
      return;
    }
    if (this.editor.currVoiceIdx > 0) {
      this._nextVoice(-1);
      return;
    }
    this.enableChordMode();
  }

  goDown() {
    if (this.isChordMode()) {
      const currTime = this.getCursorTime();
      this.disableChordMode();
      this._setVoiceIdxAndAlign(0, currTime);
      return;
    }
    if (this.editor.currVoiceIdx + 1 < this.doc.voices.length) {
      this._nextVoice(1);
      return;
    }
    this.enableChordMode();
    this.navDown();
  }

  _finalVoice() {
    this.setVoiceIdx(this.doc.voices.length - 1);
  }

  _nextVoice(jump, oldCurrTime) {
    jump = jump || 1;
    const newCurrVoiceIdx = math.mod(
      this.editor.currVoiceIdx + jump, this.doc.voices.length);
    if (newCurrVoiceIdx !== this.editor.currVoiceIdx + jump) {
      return;
    }
    this._setVoiceIdxAndAlign(newCurrVoiceIdx, oldCurrTime);
  }

  _alignTime(oldCurrTime) {
    const maxNotesPerLine = 999;
    iter.boundedWhile(breakFunc => {
      if (this.getCursorTime().lessThan(oldCurrTime)) {
        return breakFunc();
      }
      // Use navLeftMeasure instead of navLeft to ensure
      // that in chord mode, the cursor is not in between beats.
      this.navLeftMeasure();
    }, maxNotesPerLine);
    iter.boundedWhile(breakFunc => {
      if (this.getCursorTime().geq(oldCurrTime)) {
        return breakFunc();
      }
      this.navRight();
    }, maxNotesPerLine);
  }

  toggle24And44() {
    if ([2, 4].indexOf(this.doc.timeSigNumer) === -1) {
      this.ebanner.slowDisplay(
        'This only works for 2/4 or 4/4 time signatures.');
      return;
    }
    const mult = this.doc.timeSigNumer === 2 ? frac.build(2) : frac.build(1, 2);
    this.doc.timeSigNumer = frac.build(this.doc.timeSigNumer).times(mult).toFloat();
    this.doc.chordLocs.forEach(loc => {
      loc.start = loc.start.times(mult);
    });
    this.doc.keySigLocs.forEach(loc => {
      loc.start = loc.start.times(mult);
    });
    this.doc.voices.forEach(voice => {
      voice.noteGps.toArray().forEach(noteGp => {
        noteGp.start = noteGp.start.times(mult);
        noteGp.end = noteGp.end.times(mult);
      });
    });
    // Note that setPickup is not used because noteGp
    // shifting is completed above.
    this.doc.pickup = this.doc.pickup.times(mult);
    this.setTempo(frac.build(this.getTempo()).times(mult).toFloat());
  }

  swingify() {
    this.doc.tempoStr = '';
    const newVoices = [];
    this.doc.voices.forEach(voice => {
      const noteGpsArr = voice.noteGps.toArray();
      const beatDur = frac.build(1, 4);
      const res = chunking.periodicSplit(noteGpsArr, beatDur)
      res.forEach((_, idx) => {
        // Perform mutation
        _swingifyOneBeat(res, idx);
      });
      newVoices.push(Voice.fromNoteGpsArray(
        chunking.mergeTiesAndRests(res), voice.clef));
    });
    this.doc.setVoices(newVoices);
  }

  implicitSwing() {
    if (this.doc.tempoStr == 'Swing') {
      this.doc.tempoStr = '';
      return;
    }
    this.doc.tempoStr = 'Swing';
    const durationPerMeasure = frac.build(
      this.doc.timeSigNumer, this.doc.timeSigDenom);
    const newVoices = [];
    this.doc.voices.forEach(voice => {
      const noteGpsArr = voice.noteGps.toArray();
      const resNoteGps = [];
      chunking.splitIntoMeasures(noteGpsArr, durationPerMeasure).forEach(meas => {
        if (meas.length === 0) {
          return;
        }
        const start = meas[0].start;
        const end = meas[meas.length - 1].end;
        const chunks = chunking.exec(
          meas, start, end, this.doc.timeSigNumer, this.doc.timeSigDenom);
        chunks.forEach(chunk => {
          const noteGpsArrInChunk = chunk.getNoteGps();
          const isTuplet = chunk instanceof chunking.TupletChunk;
          if (isTuplet) {
            if (noteGpsArrInChunk.length === 2) {
              const left = noteGpsArrInChunk[0];
              if (left.getDuration().equals(frac.build(1, 6))) {
                const right = noteGpsArrInChunk[1];
                if (right.getDuration().equals(frac.build(1, 12))) {
                  // TODO move this into a helper for alt-left and alt-right.
                  const leftClone = left.clone();
                  const rightClone = right.clone();
                  leftClone.end = left.start.plus(frac.build(1, 8));
                  rightClone.start = leftClone.end;
                  resNoteGps.push(leftClone, rightClone);
                  return;
                }
              }
            }
          }
          resNoteGps.push(...noteGpsArrInChunk);
        });
      });
      newVoices.push(Voice.fromNoteGpsArray(
        chunking.mergeTiesAndRests(resNoteGps), voice.clef));
    });
    this.doc.setVoices(newVoices);
  }

  enharmSpelling(spellingsStr) {
    if (this.isChordMode()) {
      return;
    }
    const currNoteGp = this.getCurrVoice().noteGps.getCurr();
    if (!currNoteGp) {
      return;
    }
    if (!spellingsStr) {
      currNoteGp.notes.forEach(note => {
        note.spelling = null;
      });
      return;
    }
    const spellings = spellingsStr.split(',').map(str => {
      const chord = _parseChordStr(str, this.ebanner);
      if (!chord) {
        return null;
      }
      return chord.root;
    });
    if (spellings.some(s => { return s == null; })) {
      return;
    }
    if (spellings.length != currNoteGp.notes.length) {
      return;
    }
    currNoteGp.notes.forEach((note, idx) => {
      note.spelling = spellings[idx];
    });
  }

  // Only for the purpose of auto-generating comping
  appendVoice() {
    if (this.doc.chordLocs.length === 0) {
      this.ebanner.slowDisplay(
        'This only works if you have added chords to the song.');
      return;
    }
    this.disableChordMode();
    this._finalVoice();
    this.addVoice();
  }

  addVoice(voice) {
    const nextIdx = this.isChordMode() ? 0 : this.editor.currVoiceIdx + 1;
    voice = voice || new Voice(null, 'bass');
    this.doc.voices.splice(nextIdx, 0, voice);
    if (nextIdx === 0) {
      this.goDown();
    } else {
      this._nextVoice();
    }
  }

  removeVoice() {
    if (this.isChordMode()) {
      this.doc.clearChords();
      return;
    }
    if (this.doc.voices.length < 2) {
      return;
    }
    const oldCurrTime = this.getCursorTime();
    this.doc.voices.splice(this.editor.currVoiceIdx, 1);
    this._nextVoice(-1, oldCurrTime);
  }

  toggleClef() {
    if (this.isChordMode()) {
      return;
    }

    const voice = this.getCurrVoice();
    voice.clef = voice.clef != 'treble' ? 'treble' : 'bass';
  }

  _abcVoices() {
    return this.doc.voices.map((voice, idx) => {
      const showChords = idx === 0;
      // const showChords = false;
      const showChordsCursor = !this.viewMode && showChords && this.editor.cursorOnChords;
      const chordLocs = (
        showChordsCursor ? addChordCursor(this.doc.chordLocs, this.getCursorTime()) :
        this.doc.chordLocs);
      const showNotesCursor = !this.viewMode && !this.editor.cursorOnChords && idx === this.editor.currVoiceIdx;
      return voice.getAbcStrings(
        this.abcNoteDuration,
        this.doc,
        this.showSpelling,
        chordLocs,
        showChords,
        showNotesCursor,
        idx,
        this.getCursorTime());
    }).flat();
  }

  toggleView() {
    this.save();
    const url = new URL(document.URL);
    let view = url.searchParams.get('view');
    view = view === '1' ? '0' : '1';
    const newUrl = new URL(document.URL);
    newUrl.searchParams.set('view', view);
    window.location.href = newUrl;
  }

  setComposer(c) {
    this.doc.composer = c;
  }

  cut() {
    if (this.isChordMode()) {
      this.ebanner.display('Not supported');
      return;
    }
    this.copy();
    this.truncateRight();
  }

  truncateRight() {
    const noteGps = this.getCurrVoice().noteGps;
    const cursorTime = this.getCursorTime();
    while(!noteGps.atTail()) {
      this.skipRight();
      this.unsafeRemoveFromNoteGps();
    }
    this.setCursorTimeSyncPointer(cursorTime);
  }

  // TODO think about pasting multiple voices with chords, and
  // recording the links/title of the pasted parts.
  copy() {
    let data = null;
    if (this.isChordMode()) {
      const currTime = this.getCursorTime();
      data = this.doc.chordLocs.filter(chordLoc => {
        return !chordLoc.start.lessThan(currTime);
      }).map(chordLoc => {
        const clone = chordLoc.clone();
        clone.start = chordLoc.start.minus(currTime);
        return clone;
      });
    } else {
      if (this._isOutOfSync()) {
        this._surger();
      }
      const noteGpArr = this.getCurrVoice().noteGps.toArrayStartingFromCurr();
      const voice = Voice.fromNoteGpsArray(noteGpArr);
      data = voice.toJson();
    }
    localStorage.setItem('pasteBuffer', JSON.stringify(data));
  }

  paste() {
    let data;
    let json;
    try {
      data = localStorage.getItem('pasteBuffer');
      json = JSON.parse(data);
    } catch (err) {
      console.log('Pasting non-music data.', err, data);
      return;
    }
    if (this.isChordMode()) {
      let chordLocs;
      try {
        chordLocs = json.map(loc => { return ChordLoc.fromJson(loc); });
      } catch(err) {
        this.ebanner.display('Error: Pasting non-chord JSON.');
        console.log('Pasting non-chord JSON.', err, json);
        return;
      }
      const currTime = this.getCursorTime();
      chordLocs.forEach(chordLoc => {
        const clone = chordLoc.clone();
        clone.start = chordLoc.start.plus(currTime);
        this._insertChordLoc(clone);
      });
      return;
    }
    let voice;
    try {
      voice = Voice.fromJson(json);
    } catch(err) {
      this.ebanner.display('Error: Pasting non-voice JSON.');
      console.log('Pasting non-voice JSON.', err, json);
      return;
    }
    const noteGpsArr = voice.noteGps.toArray();
    this.insertNoteGps(noteGpsArr);
  }

  insertNoteGps(noteGpsArr, stationaryCursor) {
    if (noteGpsArr.length == 0) {
      return;
    }
    const currTime = this.getCursorTime();
    const shift = currTime.minus(noteGpsArr[0].start);
    noteGpsArr.forEach(noteGp => {
      noteGp.start = noteGp.start.plus(shift);
      noteGp.end = noteGp.end.plus(shift);
    });
    noteGpsArr.forEach(noteGp => {
      this.upsertByDur(
        noteGp.notes.map(note => {return note.noteNum;}),
        noteGp.end.minus(noteGp.start));
    });
    if (stationaryCursor) {
      this.setCursorTimeSyncPointer(currTime);
    }
  }

  getAbc() {
    const tempoStr = this.doc.tempoStr ? `"${this.doc.tempoStr}"` : '';
    return `X: 1
T: ${this.doc.title}
C: ${this.doc.composer}
M: ${this.doc.timeSigNumer}/${this.doc.timeSigDenom}
K: ${this.doc.keySigSp.toString()}
Q: ${this.abcNoteDuration.toString()} = ${this.doc.tempo} ${tempoStr}
L: ${this.abcNoteDuration.toString()}
${this._abcVoices().join('')}
`;
  }
}

// idx is the potential start of a beat.
function _swingifyOneBeat(noteGpsArr, idx) {
  const noteGp0 = noteGpsArr[idx];
  // Don't swing if noteGp0 is not at the start of a beat.
  if (!noteGp0.start.times(frac.build(4)).isWhole()) {
    return;
  }
  const oneBeat = frac.build(1, 4);
  const dur0 = noteGp0.getDuration();
  if (!dur0.lessThan(oneBeat)) {
    return;
  }
  if (idx + 1 >= noteGpsArr.length) {
    return;
  }
  const noteGp1 = noteGpsArr[idx + 1];
  const dur1 = noteGp1.getDuration();
  if (!dur0.plus(dur1).lessThan(oneBeat)) {
    if (noteGp0.tie) {
      return;
    }
    const newDur0 = (
      dur0.lessThan(frac.build(1, 8)) ? frac.build(1, 12)
      : frac.build(1, 6));
    noteGp0.end = noteGp0.start.plus(newDur0);
    noteGp1.start = noteGp0.end;
    return;
  }
  if (idx + 2 >= noteGpsArr.length) {
    return;
  }
  const noteGp2 = noteGpsArr[idx + 2];
  const dur2 = noteGp2.getDuration();
  // Don't swing if there are more than 3 notes in a beat.
  if (dur0.plus(dur1).plus(dur2).lessThan(oneBeat)) {
    return;
  }

  noteGp0.end = noteGp0.start.plus(frac.build(1, 12));
  noteGp1.start = noteGp0.end;
  noteGp1.end = noteGp1.start.plus(frac.build(1, 12));
  noteGp2.start = noteGp1.end;
}

function findUpsertIdx(inputChordLocs, time) {
  // Case 1: on the far left.
  if (inputChordLocs.length === 0 || time.lessThan(inputChordLocs[0].start)) {
    return {idx: 0, update: false};
  }
  for (let idx = 0; idx < inputChordLocs.length; idx++ ) {
    const chordLoc = inputChordLocs[idx];
    // Case 2: time is at idx
    if (time.equals(chordLoc.start)) {
      return {idx: idx, update: true};
    }
    // Case 4: on the far right.
    if (idx + 1 >= inputChordLocs.length) {
      return {idx: inputChordLocs.length, update: false};
    }
    // Case 3: time is sandwiched between idx and idx + 1
    const nextChordLoc = inputChordLocs[idx+1];
    const sandwiched = chordLoc.start.lessThan(time) && time.lessThan(nextChordLoc.start);
    if (sandwiched) {
      return {idx: idx + 1, update: false};
    }
  }
  // Impossible.
  console.warn('failed to find upsertIdx; inputChordLocs, time:', inputChordLocs, time);
  throw 'failed to find upsertIdx';
}

function addChordCursor(inputChordLocs, cursorTime) {
  const upsertInfo = findUpsertIdx(inputChordLocs, cursorTime);
  if (upsertInfo.update) {
    return inputChordLocs.map((chordLoc, idx) => {
      const clone = chordLoc.clone();
      if (idx === upsertInfo.idx) {
        clone.onCursor = true;
      }
      return clone;
    });
  }
  const res = inputChordLocs.map(chordLoc => {
    return chordLoc.clone();
  });
  res.splice(upsertInfo.idx, 0, new ChordLoc(null, cursorTime, true));
  return res;
}

function _parseChordStr(chordStr, ebanner) {
  if (!chordStr) {
    return;
  }
  try {
    return new chd.Chord(Parser.parse(chordStr));
  } catch(err) {
    if (ebanner) {
      ebanner.display('failed to parse chord: ' + chordStr);
    }
    console.warn('failed to parse chord: ', chord, err);
    return;
  }
}

function getSongUrl(id) {
  const newUrl = new URL(document.URL.split('#')[0]);
  newUrl.searchParams.set('id', id);
  return newUrl;
}

function collapseGraceNotesToSimultaneousNotes(noteGps) {
  function _merge(noteGpsToMerge) {
    if (noteGpsToMerge.length == 0) {
      throw 'noteGpsToMerge.length cannot be 0.';
    }
    const notes = [];
    const lastNoteGp = noteGpsToMerge[noteGpsToMerge.length - 1].clone();
    noteGpsToMerge.forEach(noteGp => {
      notes.push(...noteGp.notes);
    });
  return new NoteGp(notes, lastNoteGp.start, lastNoteGp.end, lastNoteGp.tie);
  }

  const res = [];
  let noteGpsToMerge = [];
  for (let idx = 0; idx < noteGps.length; idx++) {
    const currNoteGp = noteGps[idx];
    if (noteGpsToMerge.length == 0) {
      noteGpsToMerge.push(currNoteGp);
      continue;
    }
    if (noteGpsToMerge[0].start.equals(currNoteGp.start)) {
      noteGpsToMerge.push(currNoteGp);
      continue;
    }
    // Context: currNoteGp start at a different place.
    // Outcome: merge and re-initialize oteGpsToMerge.
    res.push(_merge(noteGpsToMerge));
    noteGpsToMerge = [currNoteGp];
  }
  if (noteGpsToMerge.length > 0) {
    res.push(_merge(noteGpsToMerge));
  }
  return res;
}