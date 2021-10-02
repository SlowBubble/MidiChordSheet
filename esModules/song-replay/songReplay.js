import { NoteOffEvt, NoteOnEvt } from "../midi-data/midiEvent.js";
import { MetronomeBeat } from "../musical-beat/metronome.js";
import { createDrumVoice, createBeat8nArr } from "./drumVoice.js";
import { mod } from "../math-util/mathUtil.js";
import { makeFrac } from '../fraction/fraction.js';

export class SongReplayer {
  constructor({musicalSound, metronomeBeatPub}) {
    this._musicalSound = musicalSound;
    this._midiEvtsExecCountDown = null;
    this._currTime8n = null;
    this._metronomeBeatPub = metronomeBeatPub;
  }

  // opts:
  //   - start8n (Required)
  //   - addDrumBeat
  //   - numBeatDivisions
  play(song, opts) {
    opts = opts || {};

    const voices = song.getSoundingVoices();
    if (opts.addDrumBeat) {
      voices.push(createDrumVoice(song, opts));
    }
    const channelInfos = voices.map((voice, idx) => {
      return {
        // idx 0 is used for midi input, not for replay
        channelNum: idx + 1,
        instrumentName: voice.settings.instrument,
      };
    });
    this._musicalSound.configure(channelInfos);

    const timeMsToMidiEvts = _computeTimeMsToMidiEvts(song, voices, channelInfos, opts);
    const timesWithMidiEvts = timeMsToMidiEvts.getSortedTimesWithMidiEvts();
    const timeMsToBeat8n = createBeat8nArr(song).reduce((accum, beat8n) => {
      accum[time8nToMs(beat8n, song.tempo8nPerMinChanges.defaultVal)] = beat8n;
      return accum;
    }, {});
    const opts2 = {...opts};
    opts2.start8n = opts2.start8n || song.getStart8n();
    this._execCurrMidiEvtsAndWait(opts2, timeMsToBeat8n, timesWithMidiEvts, 0);
  }
  stop() {
    window.clearTimeout(this._midiEvtsExecCountDown);
    this._midiEvtsExecCountDown = null;
    this._musicalSound.stopAll();
  }
  isPlaying() {
    return this._midiEvtsExecCountDown !== null;
  }
  getCurrTime8n() {
    return this._currTime8n;
  }

  _execCurrMidiEvtsAndWait(opts, timeMsToBeat8n, timesWithMidiEvts, timeIdx) {
    if (timeIdx >= timesWithMidiEvts.length) {
      this.stop();
      return;
    }
    const curr = timesWithMidiEvts[timeIdx];
    curr.midiEvts.forEach(midiEvt => {
      this._musicalSound.execute(midiEvt);
    });
    const beat8n = timeMsToBeat8n[curr.timeMs];
    if (beat8n) {
      this._currTime8n = beat8n;
    }
    if (this._metronomeBeatPub && beat8n) {
      this._metronomeBeatPub(new MetronomeBeat({
        time: Date.now(), time8n: beat8n, isPickup: beat8n.lessThan(opts.start8n),
      }));
    }
    if (timeIdx >= timesWithMidiEvts.length - 1) {
      this.stop();
      return;
    }
    const waitTime = timesWithMidiEvts[timeIdx + 1].timeMs - curr.timeMs;
    this._midiEvtsExecCountDown = window.setTimeout(_ => {
      this._execCurrMidiEvtsAndWait(opts, timeMsToBeat8n, timesWithMidiEvts, timeIdx + 1);
    }, waitTime);
  }
}

function _computeTimeMsToMidiEvts(song, voices, channelInfos, opts) {
  const timeToRollingInfo = {};
  voices.forEach(voice => {
    voice.noteGps.forEach(qng => {
      if (!qng.isRollingDown && !qng.isRollingUp) {
        return;
      }
      if (qng.isRest) {
        return;
      }
      const startStr = qng.start8n.toString();
      const rollingInfo = timeToRollingInfo[startStr] || {noteNums: [], earliestMs: Infinity, latestMs: -Infinity};
      timeToRollingInfo[startStr] = rollingInfo;
      rollingInfo.noteNums = [...new Set(rollingInfo.noteNums.concat(qng.midiNotes.map(note => note.noteNum)))];
      rollingInfo.noteNums.sort((a, b) => a - b);
      rollingInfo.earliestMs = Math.min(rollingInfo.earliestMs, qng.getEarliestStartTime());
      rollingInfo.latestMs = Math.max(rollingInfo.latestMs, qng.getLatestStartTime());
    })
  });
  // TODO for NoteOn1 NoteOn2 NoteOff1 NoteOff2, make time of NoteOff1 the time of NoteOn2 - 1.
  const timeToMidiEvts = new TimeMsToMidiEvts();
  voices.forEach((voice, voiceIdx) => {
    const channelNum = channelInfos[voiceIdx].channelNum;
    voice.noteGps.forEach((qng, idx) => {
      // TODO adjust for multi-grace notes and 2-handed rolled chords (i.e. spanning 2 voices).
      const startAndEnd = _computeStartAndEnd(
        qng, idx >= voice.noteGps.length ? null : voice.noteGps[idx], song, opts);
      if (!startAndEnd) {
        return;
      }
      qng.midiNotes.forEach(midiNote => {
        const startMs = _accountForRollingInStartMs(startAndEnd.startMs, qng, midiNote.noteNum, timeToRollingInfo);
        timeToMidiEvts.add(startMs, new NoteOnEvt({
          noteNum: midiNote.noteNum,
          velocity: midiNote.velocity * voice.settings.volumePercent / 100,
          channelNum: channelNum,
        }));
        timeToMidiEvts.add(startAndEnd.endMs, new NoteOffEvt({
          noteNum: midiNote.noteNum,
          channelNum: channelNum,
        }));
      });
    });
  });
  return timeToMidiEvts;
}

function _accountForRollingInStartMs(startMs, qng, noteNum, timeToRollingInfo) {
  if (!qng.isRollingUp && !qng.isRollingDown) {
    return startMs;
  }
  const rollingInfo = timeToRollingInfo[qng.start8n.toString()];
  if (!rollingInfo) {
    return startMs;
  }
  const noteIdx = rollingInfo.noteNums.indexOf(noteNum);
  if (noteIdx == -1) {
    return startMs;
  }
  const biggestIdx = rollingInfo.noteNums.length - 1;
  if (biggestIdx <= 0) {
    return startMs;
  }
  const rollDur = (rollingInfo.latestMs - rollingInfo.earliestMs);
  if (qng.isRollingUp) {
    return startMs + rollDur * noteIdx / biggestIdx;
  }
  return startMs + rollDur * (biggestIdx - noteIdx) / biggestIdx;
}
// TODO should we handle consecutive grace notes in this func?
function _computeStartAndEnd(qng, nextQng, song, opts) {
  if (opts.start8n && qng.start8n.lessThan(opts.start8n)) {
    return null;
  }

  const tempo8nPerMin = song.tempo8nPerMinChanges.defaultVal;
  const {start8n, end8n} = takeSwingIntoAccount(qng, nextQng, song);
  const normalStartMs = time8nToMs(start8n, tempo8nPerMin);
  const normalEndMs = time8nToMs(end8n, tempo8nPerMin);
  const realEndMs = time8nToMs(qng.realEnd8n, tempo8nPerMin);
  if (qng.isStaccato) {
    return {
      startMs: normalStartMs,
      endMs: realEndMs,
    }
  }
  if (qng.isLogicalGraceNote) {
    const durMs = Math.max(qng.getLatestEndTime() - qng.getLatestStartTime(), 250);
    return {
      startMs: normalStartMs - durMs,
      endMs: normalEndMs,
    }
  }
  return {
    startMs: normalStartMs,
    // endMs: Math.max(realEndMs, normalEndMs),
    endMs: Math.min(realEndMs, normalEndMs),
  }
}

function takeSwingIntoAccount(qng, nextQng, song) {
  // TODO make use of swing.dur8n
  const swing = song.swingChanges.defaultVal;
  const startInSwingDur = qng.start8n.over(swing.dur8n);
  const startIsSwung = (
    startInSwingDur.isWhole() &&
    mod(startInSwingDur.numer, 2) == 1 &&
    qng.end8n.minus(qng.start8n).geq(swing.dur8n)
  );
  let start8n = qng.start8n;
  if (startIsSwung) {
    start8n = qng.start8n.minus(1).plus(makeFrac(
      swing.ratio.numer * 2, swing.ratio.numer + swing.ratio.denom
    ));
  }
  const endInSwingDur = qng.end8n.over(swing.dur8n);
  const endIsSwung = (
    endInSwingDur.isWhole() &&
    mod(endInSwingDur.numer, 2) == 1 &&
    nextQng &&
    nextQng.end8n.minus(nextQng.start8n).geq(swing.dur8n)
  );
  let end8n = qng.end8n;
  if (endIsSwung) {
    end8n = qng.end8n.minus(1).plus(makeFrac(
      swing.ratio.numer * 2, swing.ratio.numer + swing.ratio.denom
    ));
  }
  return {
    start8n: start8n,
    end8n: end8n,
  }
}
function time8nToMs(time8n, tempo8nPerMin) {
  const msPer8n = 6e4 / tempo8nPerMin;
  return time8n.toFloat() * msPer8n;
}

class TimeMsToMidiEvts {
  constructor() {
    this._mapping = {};
  }

  add(timeMs, midiEvt) {
    this._mapping[timeMs] = this._mapping[timeMs] || [];
    this._mapping[timeMs].push(midiEvt);
  }

  getSortedTimesWithMidiEvts() {
    const orderedTimeMs = Object.keys(this._mapping);
    orderedTimeMs.sort((a, b) => a - b);
    return orderedTimeMs.map(timeMs => {
      return {timeMs: timeMs, midiEvts: this._mapping[timeMs]};
    });
  }
}
