import * as frac from './frac.js';

export function nextMeasureTime(currTime, durationPerMeasure) {
  const numMeasure = measureNum(currTime, durationPerMeasure) + 1;
  return durationPerMeasure.times(frac.build(numMeasure));
}

export function measureNumToTime(measNum, durationPerMeasure, pickup) {
  const res = durationPerMeasure.times(frac.build(measNum));
  if (res.lessThan(pickup.negative())) {
    return pickup.negative();
  }
  return res;
}

export function computePrevBeat(currTime, step) {
  if (currTime.over(step).isWhole()) {
    return currTime.minus(step);
  }
  return frac.build(Math.floor(currTime.over(step).toFloat())).times(step);
}

// First measure should be measure number 0.
export function measureNum(currTime, durationPerMeasure) {
  return Math.floor(currTime.over(durationPerMeasure).toFloat());
}

export function lineNum(measNum, barsPerLine) {
  return measNum >= 0 ? Math.floor(measNum / barsPerLine) : 0;
}