import * as midiNote from './midiNote.js';
import * as midiNoteGp from './midiNoteGp.js';
import * as gap from './gap.js';

export function stitchAll(midiEvts) {
  return gap.group(midiEvts).reduce((accum, currMidiEvts) => {
    return shiftAndStitch(accum, currMidiEvts);
  }, [])
}

// WARNING: midiEvts2 will be mutated.
function shiftAndStitch(midiEvts1, midiEvts2) {
  const maxNumEvtsToLookBack = 15;
  const unchanged = midiEvts1.concat(midiEvts2);
  const midiNoteGps1 = midiNoteGp.toLeftAlignedMidiNoteGps(midiEvts1);
  const midiNoteGps2 = midiNoteGp.toLeftAlignedMidiNoteGps(midiEvts2);
  const maxLen = Math.min(midiNoteGps1.length, midiNoteGps2.length, maxNumEvtsToLookBack);
  if (maxLen <= 2) {
    return unchanged;
  }
  // 1. Figure out how much to shift.
  const reports = [];
  for (let shift = 2; shift <= maxLen; shift++) {
    reports.push(reportDiffs(midiNoteGps1, midiNoteGps2, shift));
  }
  reports.sort((r1, r2) => {
    return (r1.numDiffs - r2.numDiffs) - (r1.numMatches - r2.numMatches);
  });

  const report = reports[0];
  if (report.numMatches / (report.numMatches + report.numDiffs) < 0.7) {
    // 0.7 because at least 2 out of 3 notes should match.
    return unchanged;
  }

  // 2. Stitch
  const midiNotes1 = midiNote.toMidiNotes(midiEvts1);
  const midiNotes2 = midiNote.toMidiNotes(midiEvts2);
  const borderNoteGp = midiNoteGps1[midiNoteGps1.length - report.shift];
  const borderTime = borderNoteGp.getEarliestStartTime();
  const timeShift = midiNotes2[0].getStartTime() - borderTime;
  const resMidiNotes = midiNotes1.filter(note => {
    return note.getStartTime() < borderTime;
  }).concat(midiNotes2.map(note => {
    note.setStartTime(note.getStartTime() - timeShift);
    note.setEndTime(note.getEndTime() - timeShift);
    return note;
  }));
  // toMidiEvts also cleans up the ordering of events.
  return midiNote.toMidiEvts(resMidiNotes);
}

function reportDiffs(midiNoteGps1, midiNoteGps2, shift) {
  const slice1 = midiNoteGps1.slice(midiNoteGps1.length - shift);
  const slice2 = midiNoteGps2.slice(0, shift);
  const maxLen = Math.min(slice1.length, slice2.length);
  let numMatches = 0;
  let numDiffs = 0;
  for (let idx = 0; idx < maxLen; idx++) {
    const noteNums1 = slice1[idx].getNoteNums();
    const noteNums2 = slice2[idx].getNoteNums();

    const numLocalMatches = getNumMatches(noteNums1, noteNums2);
    const numLocalDiffs = Math.max(noteNums1.length, noteNums2.length) - numLocalMatches;
    numMatches += numLocalMatches;
    numDiffs += numLocalDiffs;
  }
  return {
    shift: shift,
    numDiffs: numDiffs,
    numMatches: numMatches,
  }
}

function getNumMatches(arr1, arr2) {
  let res = 0;
  const set2 = new Set(arr2);
  arr1.forEach(val => {
    if (set2.has(val)) {
      res++;
    }
  });
  return res;
}