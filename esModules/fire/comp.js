
import * as beat from './beat.js'
import * as frac from './frac.js';

const compSeed = 54;

function bossaNovaCompRhythm(duration, notes) {
  const res = [];
  if (duration.leq(frac.build(1, 4))) {
    return [beat.buildNote(notes, frac.build(0))];
  }
  const rand1 = Math.random();
  if (rand1 < 0.3) {
    res.push(beat.buildNote(notes, frac.build(1, 8)));
  } else if (rand1 < 0.6) {
    res.push(beat.buildNote(notes, frac.build(2, 8)));
  } else if (rand1 < 0.8) {
    res.push(beat.buildNote(notes, frac.build(0)));
  } else {
    res.push(beat.buildNote([null], frac.build(0)));
  }
  if (duration.leq(frac.build(3, 4))) {
    return res;
  }
  if (Math.random() < 0.7) {
    res.push(beat.buildNote(notes, frac.build(5, 8)));
  } else {
    res.push(beat.buildNote(notes, frac.build(6, 8)));
  }
  return res;
}

export function bossaNovaComp(slot) {
  const below = slot.chord.jazzChordTonesBelow(compSeed);
  return bossaNovaCompRhythm(slot.duration, below.slice(0, 2));
}