
// Yield a cluster of midi evts that have the same start8n.
// The midi evts may have different time due to grace notes and rolled chord notes.
// The time is relative to the latest time of the previous cluster.
function* streamMidiEvtsClusters(song, opts) {
  const voiceIdxToNoteGpIdx = {};
  const start8n = opts.start8n;
  // TODO for drum beats, we want to use currTime8n to determine what's the next currTime8n
  let currTime8n = song.voices.reduce((accum, currVoice) => {
    const first = currVoice.noteGps[0];
    if (first && first.start8n.lessThan(accum)) {
      return first.start8n;
    }
    return accum;
  }, start8n);
  song.voices.map((voice, voiceIdx) => {
    for (let noteGpIdx = voiceIdxToNoteGpIdx[voiceIdx] || 0; noteGpIdx < voice.noteGps.length; noteGpIdx++) {
      const qng = voice.noteGps[noteGpIdx];
    }
  });
}