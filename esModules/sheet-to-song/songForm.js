import { Song } from "../song-sheet/song.js";
import { SongPart } from "./songPart.js";
import { addComping, updateTacticChanges } from "../music-comping/comping.js";
import { orchestrate } from "./orchestrate.js";
import { fromNoteNumWithFlat } from "../chord/spell.js";

export class SongForm {
  constructor({
    title = '',
    // Not yet sequenced (i.e. to be sequenced in getSequencedParts)
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

  // Sequenced via numRepeats and part.transposed
  getSequencedParts() {
    const songParts = this.getClonedParts();
    transposeSongParts(songParts);
    return songParts;
  }

  getParts() {
    return this.parts;
  }
  getClonedParts() {
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

  // TODO disable addDrumBeat in songReplay.js and do it here so that we can mute it when we want
  //   (add volumePercent = 0 at time 0 to end of first part)
  toFullyArrangedSong(muteHarmony, muteMelody) {
    const parts = this.getSequencedParts();
    if (parts.length === 0) {
      throw 'TODO: Handle no parts gracefully';
    }
  
    parts.forEach((part, idx) => {
      if (idx === parts.length - 1 && part.turnaroundStart8n) {
        part.song.chordChanges.removeWithinInterval(part.turnaroundStart8n);
      }
      addComping(part);
      updateTacticChanges(part);
    });
    
    // Must be done after comping is done.
    orchestrate(parts, this, muteHarmony, muteMelody);
  
    let songRes;
    parts.forEach(part => {
      songRes = appendToSong(songRes, part, this.title);
    });
    return songRes;
  }
}

function transposeSongParts(songParts) {
  songParts.forEach(part => {
    const song = part.song;
    const oldKey = song.keySigChanges.defaultVal;
    const newKey = fromNoteNumWithFlat(oldKey.toNoteNum() + part.transpose);
    // 1. Chords
    song.chordChanges.getChanges().forEach(change => {
      change.val.shift(oldKey, newKey);
    });
    
    // 2. Voices
    song.voices.forEach(voice => {
      voice.noteGps.forEach(noteGp => {
        noteGp.midiNotes.forEach(note => {
          note.noteNum = note.noteNum + part.transpose;
          if (note.spelling) {
            note.spelling = note.spelling.shift(oldKey, newKey);
          }
        });
      });
    });

    // 3. Key Sig
    song.keySigChanges.defaultVal = newKey;
    song.keySigChanges.changes.forEach(change => {
      change.val = fromNoteNumWithFlat(change.val.toNoteNum() + part.transpose);
    })
  });
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

