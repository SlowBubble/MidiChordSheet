import { Song } from "../song-sheet/song.js";

// TODO we will need to add structural info, such as whether this part is copied from
// another part, so that we can render a shorter version in the future.
export class SongPart {
  constructor({
    song = {}, // Song, which can have a melody or rest. Comping will be added in SongForm.
    turnaroundStart8n = undefined, // Frac, time after which chord changes should be discarded when used as the final part.
    compingStyle = CompingStyle.default,
    syncopationFactor = 0.2,
    densityPct = 20,
    transpose = 0,
  }) {
    this.song = new Song(song);
    this.turnaroundStart8n = turnaroundStart8n;
    this.compingStyle = compingStyle;
    this.syncopationFactor = syncopationFactor;
    this.densityFactor = densityPct / 100;
    this.transpose = transpose;
  }
}

// TODO move this to comping.js?
export const CompingStyle = Object.freeze({
  default: 'default',
  syncopatedBass1: 'syncopatedBass1',
})