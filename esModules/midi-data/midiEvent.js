
export const midiEvtType = Object.freeze({
  NoteOn: 'NoteOn',
  NoteOff: 'NoteOff',
  DamperPedal: 'DamperPedal',
});

// export function makeNoteOn(time, noteNum, velocity, channelNum) {
//   return {
//     type: midiEvtType.NoteOn,
//     time: time,
//     noteNum: noteNum,
//     velocity: velocity,
//     channelNum: channelNum, 
//   };
// }

// export function makeNoteOff(time, noteNum, channelNum) {
//   return {
//     type: midiEvtType.NoteOff,
//     time: time,
//     noteNum: noteNum,
//     channelNum: channelNum, 
//   };
// }

export function makeDamperPedal(time, magnitude, channelNum) {
  return {
    type: midiEvtType.DamperPedal,
    time: time,
    magnitude: magnitude,
    channelNum: channelNum, 
  };
}

export class NoteOnEvt {
  constructor({
    noteNum,
    velocity,
    channelNum,
    time,
  }) {
    this.noteNum = noteNum;
    this.velocity = velocity;
    this.channelNum = channelNum;
    this.type = midiEvtType.NoteOn;
    this.time = time;
  }
}

export class NoteOffEvt {
  constructor({
    noteNum,
    channelNum,
    time,
  }) {
    this.noteNum = noteNum;
    this.channelNum = channelNum;
    this.type = midiEvtType.NoteOff;
    this.time = time;
  }
}
