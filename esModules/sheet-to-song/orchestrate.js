import { instruments } from "../musical-sound/musicalSound.js";
import { shuffle } from "../array-util/arrayUtil.js";
import { mod } from "../math-util/mathUtil.js";

export function orchestrate(songParts, songForm) {
  if (!songParts.length || !songParts[0].song.voices.length) {
    return;
  }
  const hasMel = songParts[0].song.voices.length === 3;
  let melodyIdx = hasMel ? 0 : -1;
  let compingIdx = hasMel ? 1 : 0;
  let bassIdx = hasMel ? 2 : 1;
  const repeatPartIndices = songForm.getRepeatPartIndices();
  shuffle(compingSettings);
  let voiceIdxToSettingsIdx = {};
  voiceIdxToSettingsIdx[melodyIdx] = mod(melodyIdx, compingSettings.length);
  voiceIdxToSettingsIdx[compingIdx] = mod(compingIdx, compingSettings.length);
  voiceIdxToSettingsIdx[bassIdx] = mod(bassIdx, compingSettings.length);
  let numChannelUsed = 1;
  let muteMelody = false;
  songParts.forEach((part, partIdx) => {
    part.song.voices.forEach((voice, voiceIdx) => {
      // Mute the melody for a repeated part.
      if (voiceIdx === melodyIdx) {
        if (repeatPartIndices.has(partIdx) && partIdx > 0 && numChannelUsed < 16) {
          muteMelody = true;
          numChannelUsed++;
        }
        if (muteMelody) {
          voice.settings.volumePercent = 0;
          return;
        }
      }
      if (repeatPartIndices.has(partIdx) && voiceIdx !== melodyIdx && numChannelUsed < 16) {
        voiceIdxToSettingsIdx[voiceIdx] = mod((voiceIdxToSettingsIdx[voiceIdx] || 0) + 1, compingSettings.length);
        numChannelUsed++;
      }
      const setting = compingSettings[voiceIdxToSettingsIdx[voiceIdx]];
      voice.settings.instrument = setting.instrument;
      let relVolPct = 100;
      if (voiceIdx === compingIdx) {
        relVolPct = 50;
      } else if (voiceIdx === bassIdx) {
        relVolPct = 80;
      }
      voice.settings.volumePercent = relVolPct * setting.volumePercent / 100;
    });
  });
  
}

const instrumentSettings = {
  acoustic_grand_piano: {
    instrument: instruments.acoustic_grand_piano,
    volumePercent: 45,
  },
  electric_piano_2: {
    instrument: instruments.electric_piano_2,
    volumePercent: 75,
  },
  electric_grand_piano: {
    instrument: instruments.electric_grand_piano,
    volumePercent: 45,
  },
  electric_guitar_clean: {
    instrument: instruments.electric_guitar_clean,
    volumePercent: 40,
  },
  electric_piano_1: {
    instrument: instruments.electric_piano_1,
    volumePercent: 100,
  },
}

const compingSettings = [
  instrumentSettings.acoustic_grand_piano,
  instrumentSettings.electric_grand_piano,
  instrumentSettings.electric_piano_1,
  instrumentSettings.electric_piano_2,
  instrumentSettings.electric_guitar_clean,
];
