import { Song } from "../song-sheet/song.js";
import { SongPart } from "./songPart.js";
import { Voice, clefType } from "../song-sheet/voice.js";
import { genComping } from "../music-comping/comping.js";
import { orchestrate } from "./orchestrate.js";

export class SongForm {
  constructor({
    title = '',
    parts = [], // [SongPart]
    intro = '',
    body = [], // [String]
    outro = '',
    numRepeats = 0,
  }) {
    this.title = title;
    this.parts = parts.map(part => new SongPart(part));
    this.intro = intro;
    this.body = body;
    this.outro = outro;
    this.numRepeats = numRepeats;
  }

  // // Note that this is unused.
  // toSong(numRepeats) {
  //   const parts = this.getParts(numRepeats);
  //   if (parts.length === 0) {
  //     return new Song({title: this.title});
  //   }
  //   parts[0].updateComping(); // TODO remove
  //   const res = new Song(parts[0].song);
  //   res.title = this.title;

  //   parts.slice(1).forEach(part => {
  //     appendToSong(res, part);
  //   });
  //   // addComping(res, parts);
  // }

  getParts() {
    const nameToPart = {};
    this.parts.forEach(part => {
      nameToPart[part.song.title] = part;
    });
    const sequence = [];
    if (this.intro) {
      sequence.push(this.intro);
    }
    for (let idx = 0; idx < this.numRepeats + 1; idx++) {
      sequence.push(...this.body);
    }
    if (this.outro) {
      sequence.push(this.outro);
    }
    return sequence.map(name => new SongPart(nameToPart[name]));
  }

  getRepeatPartIndices() {
    const res = [0];
    const sequence = [];
    if (this.intro) {
      sequence.push(this.intro);
    }
    for (let idx = 0; idx < this.numRepeats; idx++) {
      sequence.push(...this.body);
      res.push(sequence.length);
    }
    return res;
  }
}

// TODO disable addDrumBeat in songReplay.js and do it here so that we can mute it when we want
//   (add volumePercent = 0 at time 0 to end of first part)
export function joinSongParts(parts, songForm) {
  if (parts.length === 0) {
    throw 'TODO: Handle no parts gracefully';
  }

  parts.forEach((part, idx) => {
    if (idx === parts.length - 1 && part.turnaroundStart8n) {
      part.song.chordChanges.removeWithinInterval(part.turnaroundStart8n);
    }
    part.updateComping();
  });
  
  // Must be done after comping is done.
  orchestrate(parts, songForm);

  let songRes;
  parts.forEach(part => {
    songRes = appendToSong(songRes, part, songForm.title);
  });
  return songRes;
}

function addComping(song, parts) {
  const {bassQngs, trebleQngs} = genComping(parts);
  song.voices = [
    new Voice({noteGps: trebleQngs, clef: clefType.Treble}),
    new Voice({noteGps: bassQngs, clef: clefType.Bass}),
  ];
}

function appendToSong(song, part, title) {
  if (!song) {
    song = new Song(part.song);
    song.title = title;
    return song;
  }

  const shift8n = song.getEnd8n();
  song.voices.forEach((voice, idx) => {
    // Currently a later part can have fewer voices than an earlier part.
    if (idx >= part.song.voices.length) {
      return;
    }
    // If the note gp is a rest and it's a pickup, don't upsert it.
    voice.upsert(part.song.voices[idx].noteGps.filter(ng => ng.midiNotes.length > 0 || ng.start8n.geq(0)), shift8n);
    // Take pickup notes, i.e. start8n of a non-rest noteGp, into account.
    let start8n = shift8n;
    const firstNoteGp = voice.noteGps.find(noteGp => !noteGp.isRest);
    if (firstNoteGp && firstNoteGp.start8n.lessThan(0)) {
      start8n = shift8n.plus(firstNoteGp.start8n);
    }
    voice.settingsChanges.upsert(start8n, part.song.voices[idx].settings);
  });
  part.song.chordChanges.getChanges().forEach(change => {
    song.chordChanges.upsert(change.start8n.plus(shift8n), change.val);
  });
  return song;
}

