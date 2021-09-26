
export const VAL1 = 1;
export const VAL2 = 2;
export const VAL3 = 3;
export const CTR1 = 4;
export const CTR2 = 5;
export const CTR3 = 6;

export const valves = [
  VAL1,
  VAL2,
  VAL3,
];

export const ctrValves = [
  CTR1,
  CTR2,
  CTR3,
];

export const keyMapping = {
  j: VAL1,
  i: VAL2,
  k: VAL2,
  l: VAL3,
  f: CTR1,
  e: CTR2,
  d: CTR2,
  s: CTR3,
};

export function setup(valveDownSub, valveUpSub, notedownPub, noteupPub, valvesDiv) {
  const vavleSwitchDelayMillis = 50;
  const downValves = {};
  // The delay object before blowing the trumpet,
  let blowDelay = null;
  let currDownNoteNum = null;

  function update() {
    window.clearTimeout(blowDelay);
    if (valvesDiv) {
      valvesDiv.textContent = JSON.stringify(downValves);
    }
    const noteNum = toNoteNum(downValves);
    if (isNaN(noteNum)) {
      return;
    }
    // Compute the time earlier to not count the delay.
    const time = Date.now();
    blowDelay = window.setTimeout(_ => {
      if (currDownNoteNum) {
        noteupPub([currDownNoteNum], time);
      }
      currDownNoteNum = noteNum;
      notedownPub([noteNum], time);
    }, vavleSwitchDelayMillis);
  }

  valveDownSub(valve => {
    downValves[valve] = 1;
    update(valve);
  });

  valveUpSub(valve => {
    delete downValves[valve];
    update(valve);
  })
}

function toLowerOctave(strRep) {
  switch (strRep) {
    case '000':
      return 0; // 'C' (TODO make this NaN for 000111 for synchronization purposes)
    case '001':
      return NaN;
    case '010':
      return 6; // 'F#'
    case '011':
      return 3; // 'Eb'
    case '100':
      return 5; // 'F'
    case '101':
      return 2; // 'D'
    case '110':
      return 4; // 'E'
    case '111':
      return 1; // 'C#'
    default:
      return NaN;
  }
}

function toUpperOctave(strRep) {
  switch (strRep) {
    case '000':
      return NaN; // NaN because 000000 needs to be NaN
    case '001':
      return NaN;
    case '010':
      return 11; // 'B'
    case '011':
      return 8; // 'G#'
    case '100':
      return 10; // 'Bb'
    case '101':
      return 7; // 'G'
    case '110':
      return 9; // 'A'
    case '111':
      return NaN; // NaN because we need this for synchronization purposes (TODO)
    default:
      return NaN;
  }
}

function getValveStrRep(downValves, enum1, enum2, enum3) {
  const bit1 = downValves[enum1] || 0;
  const bit2 = downValves[enum2] || 0;
  const bit3 = downValves[enum3] || 0;
  const bits = (bit1 << 2) | (bit2 << 1) | bit3;
  return bits.toString(2).padStart(3, '0');
}

function getShift(ctrStrRep) {
  const octave = 12;
  const shift = 4 * octave;
  switch (ctrStrRep.slice(1)) {
    case '00':
      return shift + octave;
    case '10':
      return shift + 2 * octave;
    case '01':
      return shift + 3 * octave;
    case '11':
      return shift;
    default:
      return shift;
  }
}
function toNoteNum(downValves) {
  const valveStrRep = getValveStrRep(downValves, VAL1, VAL2, VAL3);
  const ctrStrRep = getValveStrRep(downValves, CTR1, CTR2, CTR3);

  const noteNumModOctave = ctrStrRep[0] == '1' ? toLowerOctave(valveStrRep) : toUpperOctave(valveStrRep);
  return noteNumModOctave + getShift(ctrStrRep);
}