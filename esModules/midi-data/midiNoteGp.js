
class MidiNoteGp {
  constructor({midiNotes = []}) {
    this.midiNotes = [];
    this.setMidiNotes(midiNotes);
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

  getNoteNums() {
    return this.midiNotes.map(note => { return note.getNoteNum(); });
  }
}
