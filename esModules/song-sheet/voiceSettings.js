import { instruments } from "../musical-sound/musicalSound.js";

export class VoiceSettings {
  constructor({
    volumePercent = 100,
    hide = false,
    instrument = instruments.acoustic_grand_piano,
    name = '',
  }) {
    this.volumePercent = volumePercent;
    this.hide = hide;
    this.instrument = instrument;
    this.name = name;
  }
}