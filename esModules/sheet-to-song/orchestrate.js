import { instruments } from "../musical-sound/musicalSound.js";
import { shuffle } from "../array-util/arrayUtil.js";
import { mod } from "../math-util/mathUtil.js";

export function orchestrate(songParts, songForm) {
  if (!songParts.length || !songParts[0].song.voices.length) {
    return;
  }
  const numVoices = songParts[0].song.voices.length;
  const hasMel = numVoices >= 3;
  const melodyIdx = hasMel ? 0 : null;
  const voiceIndices = [...Array(numVoices).keys()];
  const compingIdx = numVoices - 2;
  const bassIdx = numVoices - 1;
  const repeatPartIndices = songForm.getRepeatPartIndices();
  const repeatPartIndicesSet = new Set(repeatPartIndices);
  shuffle(compingSettings);
  let voiceIdxToSettingsIdx = {};
  voiceIndices.forEach(idx => {
    voiceIdxToSettingsIdx[idx] = mod(idx, compingSettings.length);
  });
  // Why + 2?
  let numChannelUsed = bassIdx + 2;
  let muteMelody = false;
  songParts.forEach((part, partIdx) => {
    part.song.voices.forEach((voice, voiceIdx) => {
      // Mute the melody for a repeated part.
      if (voiceIdx === melodyIdx) {
        if (repeatPartIndicesSet.has(partIdx) && partIdx > 0 && numChannelUsed < 16) {
          muteMelody = true;
        }
        if (muteMelody) {
          voice.settings.instrument = compingSettings[voiceIdxToSettingsIdx[voiceIdx]].instrument;
          voice.settings.volumePercent = 0;
          return;
        }
      }
      if (repeatPartIndicesSet.has(partIdx)  && partIdx > 0 && voiceIdx !== melodyIdx && numChannelUsed < 16) {
        const incr = repeatPartIndices.length > 1 && repeatPartIndices[1] === partIdx ? -1 : 1;
        voiceIdxToSettingsIdx[voiceIdx] = mod((voiceIdxToSettingsIdx[voiceIdx] || 0) + incr, compingSettings.length);
        numChannelUsed++;
      }
      const setting = compingSettings[voiceIdxToSettingsIdx[voiceIdx]];
      voice.settings.instrument = setting.instrument;
      let relVolPct = 90;
      if (voiceIdx === compingIdx) {
        relVolPct = 75;
      } else if (voiceIdx === melodyIdx) {
        relVolPct = 100;
      }
      voice.settings.volumePercent = relVolPct * setting.volumePercent / 100;
    });
  });
}

const instrumentSettings = {
  acoustic_grand_piano: {
    instrument: instruments.acoustic_grand_piano,
    volumePercent: 65,
  },
  electric_piano_2: {
    instrument: instruments.electric_piano_2,
    volumePercent: 85,
  },
  electric_guitar_clean: {
    instrument: instruments.electric_guitar_clean,
    volumePercent: 25,
  },
  electric_piano_1: {
    instrument: instruments.electric_piano_1,
    volumePercent: 110,
  },
}

const compingSettings = [
  instrumentSettings.electric_piano_1,
  instrumentSettings.acoustic_grand_piano,
  instrumentSettings.electric_piano_2,
  instrumentSettings.electric_guitar_clean,
];

