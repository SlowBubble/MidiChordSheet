import { Frac } from "../fraction/fraction.js";
import { MidiNote } from "../midi-data/midiNote.js";

export function makeRest(start8n, end8n) {
  return new QuantizedNoteGp({
    start8n: start8n,
    end8n: end8n,
    realEnd8n: end8n,
  });
}

export class DecoratedNoteGp {
  constructor({
    midiNotes = [],
    isGraceNote = false,
    isRollingUp = false,
    isRollingDown = false,
    isStaccato = false,
  }) {
    this.midiNotes = [];
    this.setMidiNotes(midiNotes.map(midiNote => new MidiNote(midiNote)));

    this.isGraceNote = isGraceNote;
    this.isRollingUp = isRollingUp;
    this.isRollingDown = isRollingDown;
    this.isStaccato = isStaccato;
  }

  get isRest() {
    return this.midiNotes.length == 0;
  }

  addMidiNotes(midiNotes) {
    this.setMidiNotes(this.midiNotes.concat(midiNotes));
  }

  setMidiNotes(midiNotes) {
    this.midiNotes = midiNotes;
    this.midiNotes.sort((n1, n2) => {
      return n1.noteNum - n2.noteNum;
    });
  }

  getLatestStartTime() {
    return this.midiNotes.reduce((accum, note) => {
      return Math.max(accum, note.startTime);
    }, 0);
  }

  getEarliestStartTime() {
    return this.midiNotes.reduce((accum, note) => {
      return Math.min(accum, note.startTime);
    }, Infinity);
  }

  getLatestEndTime() {
    return this.midiNotes.reduce((accum, note) => {
      return Math.max(accum, note.endTime);
    }, 0);
  }
  getEarliestEndTime() {
    return this.midiNotes.reduce((accum, note) => {
      return Math.min(accum, note.endTime);
    }, Infinity);
  }
  getNoteNums() {
    return this.midiNotes.map(note => note.noteNum);
  }
}

export function makeSimpleQng(start8n, end8n, noteNums, velocity, spellings, channelNum) {
  noteNums = noteNums || [];
  velocity = velocity === undefined ? 40 : velocity;
  return new QuantizedNoteGp({
    start8n: start8n, end8n: end8n, realEnd8n: end8n,
    midiNotes: noteNums.map((noteNum, idx) => new MidiNote({
      noteNum: noteNum, velocity: velocity, channelNum: channelNum || 0,
      spelling: spellings ? spellings[idx] : undefined,
    })),
  });
}

export class QuantizedNoteGp extends DecoratedNoteGp {
  constructor(obj) {
    super(obj);
    this.start8n = obj.start8n ? new Frac(obj.start8n) : null;
    this.end8n = obj.end8n ? new Frac(obj.end8n) : null;
    // This is needed for replay to be faithful to recording.
    // It can also be used for end8n after rounding up to the nearest beat.
    this.realEnd8n = obj.realEnd8n ? new Frac(obj.realEnd8n) : null;
    this.lyrics = obj.lyrics || '';
  }

  // isGraceNote should only be used before quantizing.
  // Once quantized, this is the definitive way to determine grace note status.
  get isLogicalGraceNote() {
    return (this.start8n && this.end8n && this.start8n.equals(this.end8n));
  }
}