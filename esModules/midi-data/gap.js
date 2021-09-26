export const gapThreshold = 3000;

export function group(midiEvts) {
  const groups = [];
  let currGp = [];
  midiEvts.forEach((midiEvt, idx) => {
    if (currGp.length == 0) {
      currGp.push(midiEvt);
      return;
    }
    const latestEvt = currGp[currGp.length - 1];
    if (midiEvt.time - latestEvt.time  <= gapThreshold) {
      currGp.push(midiEvt);
      return;
    }
    groups.push(currGp);
    currGp = [midiEvt];
  });
  if (currGp.length > 0) {
    groups.push(currGp);
  }
  return groups;
}

export function ungroup(midiEvtsGps) {
  return midiEvtsGps.flat();
}