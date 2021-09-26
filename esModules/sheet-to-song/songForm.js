import { Song } from "../song-sheet/song.js";
import { SongPart } from "./songPart.js";
import { Voice, clefType } from "../song-sheet/voice.js";
import { genComping } from "../music-comping/comping.js";

export class SongForm {
  constructor({
    title = '',
    parts = [], // [SongPart]
    intro = '',
    body = [], // [String]
    outro = '',
  }) {
    this.title = title;
    this.parts = parts.map(part => new SongPart(part));
    this.intro = intro;
    this.body = body;
    this.outro = outro;
  }

  // For now, we will just deal with chordChanges with a single voice filled with rests.
  toSong(numRepeats) {
    const nameToPart = {};
    this.parts.forEach(part => {
      nameToPart[part.song.title] = part;
    });

    numRepeats = numRepeats || 0;
    const sequence = [];
    if (this.intro) {
      sequence.push(this.intro);
    }
    for (let idx = 0; idx < numRepeats + 1; idx++) {
      sequence.push(...this.body);
    }
    if (this.outro) {
      sequence.push(this.outro);
    }
    if (sequence.length === 0) {
      return new Song({title: this.title});
    }
    const parts = sequence.map(name => nameToPart[name]);
    parts[0].updateComping(); // TODO remove
    const res = new Song(parts[0].song);
    res.title = this.title;

    parts.slice(1).forEach(part => {
      appendToSong(res, part);
    });
    // addComping(res, parts);

    return res;
  }
}

function addComping(song, parts) {
  const {bassQngs, trebleQngs} = genComping(parts);
  song.voices = [
    new Voice({noteGps: trebleQngs, clef: clefType.Treble}),
    new Voice({noteGps: bassQngs, clef: clefType.Bass}),
  ];
}

function appendToSong(song, part) {
  const shift8n = song.getEnd8n();

  part.updateComping(); // TODO remove
  song.voices.forEach((voice, idx) => {
    voice.upsert(part.song.voices[idx].noteGps.filter(ng => ng.start8n.geq(0)), shift8n)
  });

  part.song.chordChanges.getChanges().forEach(change => {
    if (change.start8n.geq(0)) {
      song.chordChanges.upsert(change.start8n.plus(shift8n), change.val);
    }
  });
}

