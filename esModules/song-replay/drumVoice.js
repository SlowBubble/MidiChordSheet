import { range } from "../array-util/arrayUtil.js";
import { MidiNote } from "../midi-data/midiNote.js";
import { computeBeatInfo, genMidiPattern } from "../musical-beat/pattern.js";
import { instruments } from "../musical-sound/musicalSound.js";
import { QuantizedNoteGp } from "../song-sheet/quantizedNoteGp.js";
import { Voice } from "../song-sheet/voice.js";

// Note: this voice cannot just be added to the song because the pickup may not line up.
export function createDrumVoice(song, {
  drumVolume, padLeft, muteFinalMeasure
}) {
  drumVolume = drumVolume === undefined ? 1.5 : drumVolume;

  const voice = new Voice({});
  voice.settings.instrument = instruments.synth_drum;
  const isSwinging = song.swingChanges.defaultVal.ratio.greaterThan(1);
  const pattern = genMidiPattern(song.timeSigChanges.defaultVal, isSwinging);
  const genQngsFor1Period = (initial8n, mute) => {
    return pattern.evtsArrs.flatMap((evts, arrIdx) => {
      const time8n = initial8n.plus(pattern.durPerDivision8n.times(arrIdx));
      return new QuantizedNoteGp({
        start8n: time8n,
        end8n: time8n.plus(pattern.durPerDivision8n),
        realEnd8n: time8n.plus(pattern.durPerDivision8n),
        midiNotes: evts.map(evt => new MidiNote({
          noteNum: evt.noteNum, velocity: mute ? 0 : evt.velocity * drumVolume,
          startTime: 0, endTime: 0, channelNum: 0,
        })),
      });
    });
  }
  const period8n = pattern.durPerDivision8n.times(pattern.evtsArrs.length);
  const start8n = song.getStart8n();
  const end8n = song.getEnd8n();
  const startIdx = Math.ceil(start8n.toFloat() / period8n.toFloat()) - 1;
  const endIdx = Math.ceil(end8n.toFloat() / period8n.toFloat());
  for (let idx = startIdx; idx < endIdx; idx++) {
    voice.noteGps.push(...genQngsFor1Period(period8n.times(idx), muteFinalMeasure && idx == endIdx - 1).filter(qng => {
      if (qng.start8n.geq(end8n)) {
        return false;
      }
      return padLeft || qng.start8n.geq(start8n);
    }));
  }
  return voice;
}

export function createBeat8nArr(song) {
  const {numBeats, durPerBeat8n, period8n} = computeBeatInfo(song.timeSigChanges.defaultVal);
  const start8n = song.getStart8n();
  const end8n = song.getEnd8n();
  const startIdx = Math.ceil(start8n.toFloat() / period8n.toFloat()) - 1;
  const endIdx = Math.ceil(end8n.toFloat() / period8n.toFloat()) + 1;
  return range(startIdx, endIdx).flatMap(idx => {
    return range(0, numBeats).map(beatIdx => {
      return durPerBeat8n.times(beatIdx).plus(period8n.times(idx));
    });
  });
}
