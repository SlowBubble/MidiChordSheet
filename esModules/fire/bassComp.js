
import * as beat from './beat.js'
import * as frac from './frac.js';

// TODO replace 44 with something less arbitrary.
const bassSeed = 44;

function getBassNote(chord, seed) {
  seed = seed || bassSeed;
  const bassSpelling = chord.getBassSpelling();
  const noteNum = bassSpelling.toNoteNum(3) < seed ? bassSpelling.toNoteNum(3) : bassSpelling.toNoteNum(2);
  return noteNum;
}

function sameAndCloseToPrevBass(slot, prevSlot) {
  return (
    prevSlot && prevSlot.chord &&
    prevSlot.duration.lessThan(frac.build(3, 4)) &&
    prevSlot.chord.getBassSpelling().toString() == slot.chord.getBassSpelling().toString());
}

function simpleBassRhythm(note1) {
  return [beat.buildNote([note1], frac.build(0))];
}

export function simpleBass(slot, prevSlot) {
  const noteNum = getBassNote(slot.chord);
  return simpleBassRhythm(sameAndCloseToPrevBass(slot, prevSlot) ? noteNum + 12 : noteNum);
}

function twoBeatBassRhythm(duration, note1, note2) {
  const res = [beat.buildNote([note1], frac.build(0))];
  if (duration.lessThan(frac.build(2, 4))) {
    return res;
  }
  if (duration.equals(frac.build(2, 4))) {
    res.push(beat.buildNote([note2], duration.minus(frac.build(1, 4))));
    return res;
  }
  res.push(beat.buildNote([note2], duration.minus(frac.build(2, 4))));
  return res;
}

export function twoBeatBass(slot) {
  const chord = slot.chord;
  const bassNoteNum = getBassNote(chord);
  const bassIsRoot = !chord.bass || chord.bass.letter == chord.root.letter;
  const noteNum2 = bassIsRoot ? bassNoteNum + chord.getFifthInterval() : chord.root.toNoteNum(3);
  const notes = [bassNoteNum, noteNum2];
  return twoBeatBassRhythm(slot.duration, ...notes);
}

function bossaNovaBassRhythm(duration, note1, note2) {
  const res = [beat.buildNote([note1], frac.build(0))];
  if (duration.leq(frac.build(3, 8))) {
    return res;
  }
  if (Math.random() < 0.6) {
    res.push(beat.buildNote([note2], frac.build(3, 8)));
  }
  if (duration.leq(frac.build(4, 8))) {
    return res;
  }
  res.push(beat.buildNote([note2], frac.build(4, 8)));
  if (duration.leq(frac.build(7, 8))) {
    return res;
  }
  if (Math.random() < 0.6) {
    res.push(beat.buildNote([note1], frac.build(7, 8)));
  }
  return res;
}

export function bossaNovaBass(slot, prevSlot) {
  const chord = slot.chord;
  const bassNoteNum = getBassNote(chord, 30);
  const bassIsRoot = !chord.bass || chord.bass.letter == chord.root.letter;
  const secondBassNoteNum = bassIsRoot ? bassNoteNum + chord.getFifthInterval() : chord.root.toNoteNum(3);
  const notes = [bassNoteNum, secondBassNoteNum];
  if (sameAndCloseToPrevBass(slot, prevSlot)) {
    notes.reverse();
  }
  return bossaNovaBassRhythm(slot.duration, ...notes);
}
