import * as midiEvent from './midiEvent.js';

export class MidiNote {
  constructor({noteNum, startTime, endTime, velocity, channelNum, spelling}) {
    this.noteNum = noteNum;
    this.startTime = startTime;
    this.endTime = endTime;
    this.velocity = velocity;
    this.channelNum = channelNum;
    this.spelling = spelling;
  }
}

// The notes are in the order of the startTime.
export function toMidiNotes(midiEvts) {
  const noteNumToUnfinishedMidiNote = {};
  const accum = [];
  midiEvts.forEach(midiEvt => {
    if (midiEvt.type == midiEvent.midiEvtType.NoteOff) {
      _handleNoteOff(midiEvt, noteNumToUnfinishedMidiNote);
    } else if (midiEvt.type == midiEvent.midiEvtType.NoteOn) {
      _handleNoteOn(midiEvt, noteNumToUnfinishedMidiNote, accum);
    }
  });
  return accum;
}

function _handleNoteOn(midiEvt, noteNumToUnfinishedMidiNote, accum) {
  const midiNote = new MidiNote({
    noteNum: midiEvt.noteNum,
    startTime: midiEvt.time,
    velocity: midiEvt.velocity,
    channelNum: midiEvt.channelNum});
  
  if (noteNumToUnfinishedMidiNote[midiEvt.noteNum]) {
    console.warn('Consecutive noteOn without noteOff of note number: ', midiEvt.noteNum);
    _handleNoteOff(midiEvt, noteNumToUnfinishedMidiNote);
  }
  noteNumToUnfinishedMidiNote[midiEvt.noteNum] = midiNote;
  accum.push(midiNote);
}

function _handleNoteOff(midiEvt, noteNumToUnfinishedMidiNote) {
  const midiNote = noteNumToUnfinishedMidiNote[midiEvt.noteNum];
  delete noteNumToUnfinishedMidiNote[midiEvt.noteNum];
  if (midiNote) {
    midiNote.endTime = midiEvt.time;
  } else {
    console.warn('Unable to find noteOn for the noteOff of note number: ', midiEvt.noteNum);
  }
}