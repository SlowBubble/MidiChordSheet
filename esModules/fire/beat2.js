
export class Aggregator2 {
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

    noteupSub((noteNums, start) => {
  
    });
  }
}