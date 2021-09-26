import * as frac from './frac.js';
import * as math from './math.js';

export class Aggregator {
  constructor(
      beatSub, notedownSub, noteupSub, beatModeSub,
      aggrPub, appendPub, aggrStoppedPub, stateMgr) {
    // aggr will start out being a PossGraceNoteAggr until we enter
    // beat mode.
    let aggr = new PossGraceNoteAggr();
    let prevDuration = 1200;
    let appendDelay = null;

    beatModeSub((bm, time) => {
      if (bm) {
        return;
      }
      // Context: tranistioning from beat mode to non-beat mode.
      // Outcome: publish what's left in the aggr buffer.
      aggr.end = time ? time : aggr.start + prevDuration;
      aggrPub(aggr);
      aggr = new PossGraceNoteAggr();
      aggrStoppedPub();
    });

    beatSub(time => {
      window.clearTimeout(appendDelay);
      if (aggr.isPossGraceNote) {
        // Context: isPossGraceNote with a beat event means this is the first beat in beat mode.
        // Outcome: convert aggr to a non-grace-note Aggr.
        const pickupAggr = aggr;
        aggr = new Aggr(time);
        aggr.notes = pickupAggr.notes;
        return;
      }
      aggr.end = time;
      prevDuration = aggr.end - aggr.start;
      aggrPub(aggr);
      aggr = new Aggr(time);
    });

    // For non-beat mode, this is the delay to see if there is
    // only 1 note or there are more simultaneous notes.
    // Since trumpet is never in beat mode, and we don't want simultaneous notes
    // the delay is 0.
    const graceNoteConfirmationDelayMillis = stateMgr.isTrumpet ? 0 : 100;

    notedownSub((noteNums, start) => {
      window.clearTimeout(appendDelay);
      if (aggr.isPossGraceNote) {
        // Context: in non-beat mode, note is down.
        // Outcome: add note to the aggregate series of possible grace notes;
        //   if no more notes or beats come after waiting 100ms, these will become simultaneous (non-grace) notes.
        aggr.notes.push(buildNote(noteNums, start));
        appendDelay = window.setTimeout(_ => {
          // Context: in non-beat mode, 100ms after note has been down.
          // Outcome: insert the notes as simultaneous notes with the standard duration.
          appendPub(aggr.notes);
          aggr.notes = [];
        }, graceNoteConfirmationDelayMillis);
        return;
      }
      // Context: in beat mode, note is down
      // Outcome: add the notes to the current Aggr.
      aggr.notes.push(buildNote(noteNums, start));
    });
  }
}

class PossGraceNoteAggr {
  constructor() {
    this.isPossGraceNote = true;
    this.end = null;
    this.notes = [];
  }
}

class Aggr {
  constructor(start) {
    this.start = start;
    this.end = null;
    this.notes = [];
  }
}

export class Note {
  constructor(noteNums, start) {
    this.noteNums = noteNums;
    this.start = start;
  }

  clone() {
    // ... clones the array.
    return buildNote([...this.noteNums], this.start);
  }
}

export function buildNote(noteNums, start) {
  return new Note(noteNums, start);
}

const defaultNumDivisions = 4;
export class Rounder {
  constructor(aggrSub, roundedNotesPub) {
    aggrSub(aggr => {
      function compute(numDivisions) {
        const dur = aggr.end - aggr.start;
        const notes = aggr.notes.map(note => {
          const relStart = note.start - aggr.start;
          // TODO compute a score.
          const startFrac = closestFrac(relStart / dur, [numDivisions]);
          // TODO if there are 3 notes, compute a score for tuplet match.
          return buildNote(note.noteNums, startFrac, Number(relStart / dur).toFixed(2));
        });
        const diffAmount = computeDiffAmount(aggr, notes);
        return [notes, diffAmount];
      }
      let [currNotesToUse, currDiffAmount]= compute(defaultNumDivisions);
      math.range(aggr.notes.length - 1, aggr.notes.length + 2).forEach(numDivisions => {
        const [notes, diffAmount]= compute(numDivisions);
        const middle = new Set();
        notes.forEach(note => {
          if (!note.start.isWhole()) {
            middle.add(note.start.toString());
          }
        });
        if (middle.size != numDivisions - 1) {
          return;
        }
        if (currDiffAmount > diffAmount) {
          currNotesToUse = notes;
          currDiffAmount = diffAmount;
        }
      });
      roundedNotesPub(currNotesToUse);
    });
  }
}

function computeDiffAmount(aggr, roundedNotes) {
  let diffAmount = 0;
  const dur = aggr.end - aggr.start;
  aggr.notes.forEach((note, idx) => {
    const relStart = note.start - aggr.start;
    diffAmount += Math.abs(roundedNotes[idx].start.toFloat() - relStart / dur);
  });
  return diffAmount;
}

function closestFrac(float, divCfg) {
  let minDiff = 1;
  let possFrac = frac.build(0);
  divCfg.forEach(denom => {
    [...Array(denom + 1).keys()].forEach(numer => {
      const diff = Math.abs(float - numer / denom);
      if (diff < minDiff) {
        minDiff = diff;
        possFrac = frac.build(numer, denom);
      }
    });
  });

  return possFrac;
}

export class Upserter {
  constructor(roundedNotesSub, appendSub, stateMgr, actionMgr, resourceContentionDelayMillis) {
    // Delay rendering by 100ms from the start of the beat
    // to prevent resource contention.
    roundedNotesSub(notes => {
      if (true || !resourceContentionDelayMillis) {
        // don't render if resourceContentionDelayMillis is not provided.
        stateMgr.upsertBeat(notes);
        return;
      }
      actionMgr.exec(_ => {
        stateMgr.upsertBeat(notes);
      }, resourceContentionDelayMillis);
    });

    // notes is [Note]
    appendSub(notes => {
      actionMgr.exec(_ => {
        stateMgr.upsertWithoutDur(notes.map(note => {
          return note.noteNums;
        }).flat(), Date.now());
      });
    });
  }
}