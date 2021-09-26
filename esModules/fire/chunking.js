import * as frac from './frac.js';
import * as location from './location.js';
import * as math from './math.js';

export function exec(noteMeas, start, end, timeSigNumer, timeSigDenom, cursorTime) {
  let noteGpArr = noteMeas;
  // TODO remove the mergeTiesAndRests calls when all operations are converted.
  if (cursorTime) {
    noteGpArr = [];
    noteMeas.forEach(noteGp => {
      if (cursorTime.strictlyInside(noteGp.start, noteGp.end)) {
        noteGpArr.push(...noteGp.split(cursorTime));
        return;
      }
      noteGpArr.push(noteGp);
    });
  }
  let chunks = toChunks(noteGpArr);
  chunks = tupletChunking(chunks);
  chunks = _notatableChunking(chunks, start, end, timeSigNumer, timeSigDenom);
  return chunks;
}

// [noteGp] -> [noteGp]
export function periodicSplit(noteGpsArr, period) {
  const res = [];
  noteGpsArr.forEach(noteGp => {
    let remainder = noteGp;
    while (true) {
      const nextMeasTime = location.nextMeasureTime(remainder.start, period);
      if (remainder.end.leq(nextMeasTime)) {
        res.push(remainder);
        return;
      }
      const [left, right] = remainder.split(nextMeasTime);
      res.push(left);
      remainder = right;
    }
  });
  return res;
}

// TODO see if this logic can be shared with periodicSplit or locationsToLines.
// [noteGp] -> [[noteGps]]
export function splitIntoMeasures(noteGpsArr, period) {
  const res = [];
  let meas = [];
  noteGpsArr.forEach(noteGp => {
    let remainder = noteGp;
    while (true) {
      const nextMeasTime = location.nextMeasureTime(remainder.start, period);
      if (remainder.end.leq(nextMeasTime)) {
        meas.push(remainder);
        if (remainder.end.equals(nextMeasTime)) {
          res.push(meas);
          meas = [];
        }
        return;
      }
      const [left, right] = remainder.split(nextMeasTime);
      meas.push(left);
      remainder = right;
      if (remainder.end.equals(nextMeasTime)) {
        res.push(meas);
        meas = [];
      }
    }
  });
  if (meas.length > 0) {
    res.push(meas);
  }
  return res;
}

export function isPossibleTuplet(noteGp) {
  return !math.isPowerOf2(noteGp.start.getDenom()) || !math.isPowerOf2(noteGp.end.getDenom());
}

// noteGpsArr -> chunks
export function toChunks(noteGpsArr) {
  return noteGpsArr.map(noteGp => {
    return new SingletonChunk([noteGp]);
  });
}

// A logical unit of note groups that should be rendered together
class Chunk {
  constructor(noteGpsArr) {
    if (noteGpsArr.length < 1) {
      throw "noteGpsArr must not be empty."
    }
    this.noteGpsArr = noteGpsArr;
  }
  getNoteGps() {
    return this.noteGpsArr;
  }
  getAlteredNoteGps() {
    return this.noteGpsArr;
  }
  getAbcPreamble() {
    return '';
  }
}

export class SingletonChunk extends Chunk {
  constructor(noteGpsArr) {
    super(noteGpsArr);
    if (noteGpsArr.length > 1) {
      throw "SingletonChunk must have length 1."
    }
  }
}

// p = the number of notes to be put into time q
// q = the time that p notes will be played in
// r = the number of notes to continue to do this action for.
export class TupletChunk extends Chunk {
  constructor(noteGpsArr) {
    super(noteGpsArr);
    this.altered = noteGpsArr;
    this.computable = false;
    this.computable = this._computePqr();
  }
  _computePqr() {
    let nextStart = null;
    this.altered = this.noteGpsArr.map(noteGp => {
      const clone = noteGp.clone();
      const dur = noteGp.getDuration().times(frac.build(3, 2));
      if (nextStart) {
        clone.start = nextStart;
      }
      clone.end = clone.start.plus(dur);
      nextStart = clone.end;
      return clone;
    });
    this.p = 3;
    this.q = 2;
    this.r = this.getNoteGps().length;
    return true;
  }
  getAlteredNoteGps() {
    return this.altered;
  }
  getDurationMultiplier() {
    return frac.build(this.q, this.p);
  }
  getAbcPreamble() {
    return `(${this.p}:${this.q}:${this.r}`;
  }
}

// Returns startingPoint s.t. its denom isPowerOf2 and
// >= firstNoteGp.start.
// If not possible, returns null.
function _computeStartingPoint(firstNoteGp, attempt) {
  let startingPoint = firstNoteGp.end;
  while (true) {
    startingPoint = startingPoint.minus(attempt);
    if (math.isPowerOf2(startingPoint.getDenom())) {
      return startingPoint;
    }
    if (firstNoteGp.start.greaterThan(startingPoint)) {
      return null;
    }
  }
}

// Args: attempt is the unit duration.
// Returns chunks with at most 2 chunk; the right chunk is a TupletChunk.
// Returns null if the attempt failed.
function _tryTupletChunking(noteGpsArr, startIdx, attempt, idxToRemainingNoteGp, skipMerging) {
  // The result of chunking
  const chunks = [];
  // NoteGps for the main tuplet chunk.
  const tupletNoteGps = [];
  const firstNoteGp = idxToRemainingNoteGp[startIdx] || noteGpsArr[startIdx];
  const startingPoint = _computeStartingPoint(firstNoteGp, attempt);
  if (!startingPoint) {
    return null;
  }
  if (firstNoteGp.start.greaterThan(startingPoint)) {
    return null;
  }

  // The leftmost non-tuplet chunk.
  if (firstNoteGp.start.lessThan(startingPoint)) {
    const [left, _] = firstNoteGp.split(startingPoint);
    chunks.push(new SingletonChunk([left]));
  }

  // The rightmost tuplet chunk.
  let nextPoint = startingPoint;
  let currIdx = startIdx;
  while (true) {
    // The start, end and tie of currNoteGp will be reconstructed given
    // all the timing information.
    const currNoteGp = idxToRemainingNoteGp[currIdx] || noteGpsArr[currIdx];
    const unsplitTupletNoteGp = currNoteGp.clone();
    unsplitTupletNoteGp.start = nextPoint;
    nextPoint = nextPoint.plus(attempt);
    const [tupletNoteGp, _] = unsplitTupletNoteGp.split(nextPoint);
    tupletNoteGps.push(tupletNoteGp);
    if (currNoteGp.end.lessThan(nextPoint)) {
      return null;
    }

    if (math.isPowerOf2(nextPoint.getDenom())) {
      if (currNoteGp.end.greaterThan(nextPoint)) {
        // The remainder will be left for the next
        // call of _tryTupletChunking to process.
        const remainder = currNoteGp.clone();
        remainder.start = nextPoint;
        idxToRemainingNoteGp[currIdx] = remainder;
      } else {
        idxToRemainingNoteGp[currIdx] = null;
      }
      break;
    }
    if (currNoteGp.end.equals(nextPoint)) {
      currIdx += 1;
    }
    if (currIdx >= noteGpsArr.length) {
      console.warn(
        'This should not happen; nextPoint.denom should be ' +
        'power of 2 before noteGpsArr runs out.');
      return null;
    }
  }

  // Test whether merging ties and rests within the tuplet chunk is notatable.
  const mergedTupletChunk = new TupletChunk(mergeTiesAndRests(tupletNoteGps));
  // Special case to reject.
  const noteGps = mergedTupletChunk.getNoteGps();
  if (noteGps.length == 2) {
    if (noteGps[0].getDuration().equals(frac.build(1, 6))) {
      if (noteGps[1].getDuration().equals(frac.build(1, 3))) {
        return null;
      }
    }
  }
  const notatable = mergedTupletChunk.getAlteredNoteGps().every(noteGp => {
    return _isNotatable(noteGp);
  });
  if (notatable && !skipMerging) {
    chunks.push(mergedTupletChunk);
  } else {
    chunks.push(new TupletChunk(tupletNoteGps));
  }

  math.range(startIdx, currIdx).forEach(idx => {
    idxToRemainingNoteGp[idx] = null;
  });
  return chunks;
}

export function tupletChunking(singletonChunks, skipMerging) {
  const chunksWithTriplets = [];
  const noteGpsArr = singletonChunks.map(chunk => {
    return chunk.getNoteGps()[0];
  });
  // This lets the next iterations know the noteGpsArr that the current
  // iteration has modified/processed.
  // Null value means the noteGp has been processed completely.
  const idxToRemainingNoteGp = {};
  noteGpsArr.forEach((noteGp, idx) => {
    if (idxToRemainingNoteGp[idx] === null) {
      return;
    }
    noteGp = idxToRemainingNoteGp[idx] || noteGp;
    if (!isPossibleTuplet(noteGp)) {
      chunksWithTriplets.push(new SingletonChunk([noteGp]));
      return;
    }
    // const numer = noteGp.end.getNumer();
    // const baseAttemptNumer = numer > 0 ? Math.pow(2, Math.floor(Math.log2(numer))) : 1;
    let baseDenom = noteGp.end.getDenom();
    while (math.mod(baseDenom, 2) == 0) {
      baseDenom /= 2;
    }
    const baseAttempt = frac.build(1, baseDenom);
    let possChunks = null;
    for (let exponent = 0; exponent < 10; exponent++) {
      const attempt = baseAttempt.over(frac.build(Math.pow(2, exponent)));
      possChunks = _tryTupletChunking(
        noteGpsArr, idx, attempt, idxToRemainingNoteGp, skipMerging);
      if (possChunks) {
        break;
      }
    };
    if (!possChunks) {
      console.warn('tupletChunking failed', noteGpsArr, noteGp);
      chunksWithTriplets.push(new SingletonChunk([noteGp]));
      return;
    }
    chunksWithTriplets.push(...possChunks);
  });
  return chunksWithTriplets;
}

function _isNotatable(noteGp) {
  const dur = noteGp.getDuration();
  return dur.getNumer() <= 3;
}

// Nice bound will be lenient because more checks come later.
function _hasNiceBound(noteGp, timeSigDenom) {
  const dur = noteGp.getDuration();
  // Stricter bounds for 1/timeSigDenom to show beat contour clearly
  const beatDur = frac.build(1, timeSigDenom);
  if (dur.equals(beatDur)) {
    const niceStart = math.mod(dur.getDenom(), noteGp.start.getDenom()) === 0;
    const niceEnd = math.mod(dur.getDenom(), noteGp.end.getDenom()) === 0;
    return niceStart && niceEnd;
  }

  const niceStart = math.mod(2 * dur.getDenom(), noteGp.start.getDenom()) === 0;
  const niceEnd = math.mod(2 * dur.getDenom(), noteGp.end.getDenom()) === 0;
  return niceStart && niceEnd;
}

// periodNumer is the timeSigNumer restricted to left and right
function _computeDemarcations(
  noteGp, decomp, left, right, periodNumer, periodDenom) {
  const dur = noteGp.getDuration();
  // Don't break up long notes that fit perfectly.
  if (noteGp.start.equals(left) && noteGp.end.equals(right)) {
    return [];
  }
  // Don't break up long notes for simple time sig
  if (dur.greaterThan(frac.build(3, 8)) && periodNumer <= 4) {
    return [];
  }
  // Don't break up dotted quarter notes for 2/4 and 3/4 cases.
  if (dur.equals(frac.build(3, 8)) && periodNumer < 4 && periodDenom == 4) {
    return [];
  }
  // Don't break up dotted quarter notes for k/4 for k >= 4.
  const firstDecompInNoteGp = left.plus(decomp[0]).strictlyInside(noteGp.start, noteGp.end);
  if (dur.equals(frac.build(3, 8)) && periodDenom == 4 && !firstDecompInNoteGp) {
    return [];
  }

  const demarcs = [];
  let curr = left;
  while (true) {
    curr = curr.plus(frac.build(1, periodDenom));
     if (curr.geq(right)) {
       break;
     }
     demarcs.push(curr);
  }
  return demarcs
}

// Precondition: Demaracations are checked after bounds are checked to be nice.
function _crossedDemarcations(demarcs, noteGp) {
  const ans = demarcs.some(demarc => {
      return demarc.strictlyInside(noteGp.start, noteGp.end);
    });
  return ans;
}

// TODO allow override:
// const timeSigNumerDecompOverride = {
//   5: [2, 3],
// };
// Precondition: left <= noteGp.start && noteGp.end <= right
function _decompose(noteGp, left, right, timeSigNumer, timeSigDenom) {
  if (!noteGp) {
    return [];
  }
  if (noteGp.isGraceNote()) {
    return [noteGp];
  }

  const period = right.minus(left);
  if (period.lessThan(frac.build(1, 64))) {
    console.warn('There may be some issue with _decompose', noteGp, left, right);
    return [noteGp];
  }
  // periodDenom is the timeSigDenom unless the period is smaller than 1/timeSigDenom
  let periodNumer = period.getNumer();
  let periodDenom = period.getDenom();
  if (math.mod(timeSigDenom, periodDenom) === 0) {
    periodNumer = periodNumer * timeSigDenom / periodDenom;
    periodDenom = timeSigDenom;
  }
  // decomp shows duration of the left-most decomp and
  // the second left-most defcomp.
  let decomp = [
    frac.build(1, periodDenom),
    frac.build(periodNumer - 1, periodDenom)];
  if (periodNumer === 1) {
    decomp = [
      frac.build(1, 2 * periodDenom),
      frac.build(1, 2 * periodDenom)];
  }
  if (periodNumer === 4) {
    decomp = [frac.build(2, periodDenom), frac.build(2, periodDenom)];
    // This is for not splitting dotted half note for a note that
    // that goes from e.g. 1/8 to 1/1.
    // (Split to 1/8 to 1/4 and 1/4 to 4/4).
    if (noteGp.start.lessThan(left.plus(frac.build(1, timeSigDenom))) && noteGp.end.equals(right)) {
      decomp = [frac.build(1, periodDenom), frac.build(3, periodDenom)];
    }
    if (noteGp.end.greaterThan(right.minus(frac.build(1, timeSigDenom))) && noteGp.start.equals(left)) {
      decomp = [frac.build(3, periodDenom), frac.build(1, periodDenom)];
    }
  }
  if (periodNumer === 5) {
    decomp = [frac.build(3, periodDenom), frac.build(2, periodDenom)]
  }
  if (periodNumer > 5) {
    decomp = [frac.build(3, periodDenom), frac.build(3, periodDenom)];
  }

  const demarcs = _computeDemarcations(
    noteGp, decomp, left, right, periodNumer, periodDenom);
  // console.log(left, right);
  // console.log(noteGp.start);
  // console.log(noteGp.end);
  // console.log(demarcs);
  if (_isNotatable(noteGp)) {
    // console.log(_hasNiceBound(noteGp, timeSigDenom));
    if (_hasNiceBound(noteGp, timeSigDenom)) {
      const crossedDemarc = _crossedDemarcations(demarcs, noteGp);
      // console.log(crossedDemarc);
      if (!crossedDemarc) {
        return [noteGp];
      }
    }
  }

  const mid = left.plus(decomp[0]);
  if (!mid.strictlyInside(left, right)) {
    console.warn('Unexpected middle', mid, left, right);
    return [noteGp];
  }
  return _splitAndDecompose(noteGp, left, mid, right, timeSigNumer, timeSigDenom);
}

function _splitAndDecompose(noteGp, left, mid, right, timeSigNumer, timeSigDenom) {
  const [leftSplit, rightSplit] = noteGp.split(mid);
  return _decompose(leftSplit, left, mid, timeSigNumer, timeSigDenom).concat(
    _decompose(rightSplit, mid, right, timeSigNumer, timeSigDenom));
}

// Chunks that are not Tuplet should have noteGp duration 2^n at this point.
function _notatableChunking(chunks, start, end, timeSigNumer, timeSigDenom) {
  const res = [];
  chunks.forEach(chunk => {
    if (chunk instanceof TupletChunk) {
      res.push(chunk);
      return;
    }
    if (!(chunk instanceof SingletonChunk)) {
      console.warn('Chunk of unknown type', chunk)
      res.push(chunk);
      return;
    }
    const noteGp = chunk.getNoteGps()[0];
    if (!math.isPowerOf2(noteGp.getDuration().getDenom())) {
      console.warn('noteGp with non-power-of-2 denom', noteGp);
      res.push(chunk);
      return;
    }
    const dNoteGps = _decompose(noteGp, start, end, timeSigNumer, timeSigDenom);
    dNoteGps.forEach(dNoteGp => {
      res.push(new SingletonChunk([dNoteGp]));
    });
  });
  return res;
}

// [noteGp] -> [noteGp]
export function mergeTiesAndRests(noteGpsArr) {
  return _mergeRests(_mergeTies(noteGpsArr));
}

function _mergeTies(noteGpsArr) {
  const res = [];
  let startingTie = null;
  noteGpsArr.forEach(noteGp => {
    // Case 1: Notes with ties; keep track of starting point
    if (noteGp.tie) {
      if (!startingTie) {
        startingTie = noteGp;
        // TODO remove mergeTiesAndRests when input is tieless.
        // console.log('Has tie notes.')
      }
      return;
    }
    // Case 2: No tied notes before current note.
    if (!startingTie) {
      res.push(noteGp);
      return;
    }
    // Case 3: Process the tied notes before.
    const mergedNoteGp = noteGp.clone();
    mergedNoteGp.start = startingTie.start;
    res.push(mergedNoteGp);
    startingTie = null;
    return;
  });
  // Case 4: Process the tied notes not handled by case 3.
  if (startingTie && noteGpsArr.length > 0) {
    const mergedNoteGp = noteGpsArr[noteGpsArr.length - 1].clone();
    mergedNoteGp.start = startingTie.start;
    res.push(mergedNoteGp);
  }
  return res;
}

function _mergeRests(noteGpsArr) {
  const res = [];
  let startingRest = null;
  noteGpsArr.forEach(noteGp => {
    // Case 1: Rests; keep track of starting point
    if (noteGp.isRest()) {
      if (!startingRest) {
        startingRest = noteGp;
        // TODO remove mergeTiesAndRests when input is tieless.
        // console.log('Has split rest notes.')
      }
      return;
    }
    // Case 2: No rests before current note.
    if (!startingRest) {
      res.push(noteGp);
      return;
    }
    // Case 3: Process the rests before the current note.
    const mergedNoteGp = startingRest.clone();
    mergedNoteGp.end = noteGp.start;
    res.push(mergedNoteGp);
    res.push(noteGp);
    startingRest = null;
    return;
  });
  // Case 4: Process the rests not handled by case 3 because the final note is a rest.
  if (startingRest && noteGpsArr.length > 0) {
    const mergedNoteGp = startingRest.clone();
    mergedNoteGp.end = noteGpsArr[noteGpsArr.length - 1].end;
    res.push(mergedNoteGp);
  }
  return res;
}

// // chunks -> noteGpsArr
// export function toNoteGps(chunks) {
//   return chunks.map(chunk => {
//     return chunk.getNoteGps();
//   }).flat();
// }