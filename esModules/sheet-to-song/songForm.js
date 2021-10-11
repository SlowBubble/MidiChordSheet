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

  // Note that this is unused.
  toSong(numRepeats) {
    const parts = this.getParts(numRepeats);
    if (parts.length === 0) {
      return new Song({title: this.title});
    }
    parts[0].updateComping(); // TODO remove
    const res = new Song(parts[0].song);
    res.title = this.title;

    parts.slice(1).forEach(part => {
      appendToSong(res, part);
    });
    // addComping(res, parts);

    return res;
  }

  getParts(numRepeats) {
    numRepeats = numRepeats || 0;
    const nameToPart = {};
    this.parts.forEach(part => {
      nameToPart[part.song.title] = part;
    });
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
    return sequence.map(name => nameToPart[name]);
  }
}

export function joinSongParts(parts, title) {
  if (parts.length === 0) {
    return new Song({title: title});
  }
  parts[0].updateComping(); // TODO remove
  const res = new Song(parts[0].song);
  res.title = title;

  parts.slice(1).forEach(part => {
    appendToSong(res, part);
  });
  // addComping(res, parts);

  return res;
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
    // Currently a later part can have fewer voices than an earlier part.
    if (idx < part.song.voices.length) {
      voice.upsert(part.song.voices[idx].noteGps.filter(ng => ng.start8n.geq(0)), shift8n);
    }
  });

  part.song.chordChanges.getChanges().forEach(change => {
    if (change.start8n.geq(0)) {
      song.chordChanges.upsert(change.start8n.plus(shift8n), change.val);
    }
  });
}

