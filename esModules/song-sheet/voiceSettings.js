import { instruments } from "../musical-sound/musicalSound.js";
import { ChangesOverTime } from "./changesOverTime.js";

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
  equals(other) {
    return (
      this.volumePercent === other.volumePercent &&
      this.instrument === other.instrument);
  }
}

export class SettingsChanges extends ChangesOverTime {
  constructor({
    defaultVal = new VoiceSettings({}),
    ...rest
  }) {
    super({defaultVal: defaultVal, ...rest});
  }

  _deserialize(val) {
    return new VoiceSettings(val);
  }

  _equal(a, b) {
    return a.equals(b);
  }
}