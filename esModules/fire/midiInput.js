// setup should be called after a new midi input has been added.

let _notedownPub;
let _noteupPub;
let _possBeatPub;
// Use this to detect if the pedal is reversed.
let _firstPedalVelocity = null;
let _hasMidiInputs = false;

export function setup(notedownPub, noteupPub, beatPub) {
  _notedownPub = notedownPub;
  _noteupPub = noteupPub;
  _possBeatPub = beatPub;

  if (!navigator.requestMIDIAccess) {
    console.log('WebMIDI is not supported in this browser.');
    return;
  }
  navigator.requestMIDIAccess()
    .then(onMIDISuccess, onMIDIFailure);
}

export function hasMidiInputs() {
  return _hasMidiInputs;
}

function onMIDISuccess(midiAccess) {
  setupMidiInputs(midiAccess);

  midiAccess.onstatechange = function(event) {
    // console.log(event.port.name, event.port.manufacturer, event.port.state);
    setupMidiInputs(midiAccess);
  };
}

function setupMidiInputs(midiAccess) {
  _hasMidiInputs = false;
  for (let input of midiAccess.inputs.values()) {
    input.onmidimessage = handleMIDIMessage;
    _hasMidiInputs = true;
  }
}

function onMIDIFailure(err) {
  console.warn('requestMIDIAccess failed with: ', err);
}

// http://fmslogo.sourceforge.net/manual/midi-table.html
const NUM_CHANNELS = 16;
const NOTE_OFF_CHANNEL_0 = 128;
const NOTE_ON_CHANNEL_0 = 144;
const CONTROL_CHANGE_CHANNEL_0 = 176;
const DAMPER_PEDAL_DATA_BYTE = 64;

function handleMIDIMessage(message) {
  const statusByte = message.data[0];
  if (NOTE_OFF_CHANNEL_0 <= statusByte && statusByte < NOTE_OFF_CHANNEL_0 + NUM_CHANNELS) {
    // const channelNum = statusByte - NOTE_OFF_CHANNEL_0;
    const note = message.data[1];
    handleNoteOff(note);
    return;
  }
  if (NOTE_ON_CHANNEL_0 <= statusByte && statusByte < NOTE_ON_CHANNEL_0 + NUM_CHANNELS) {
    const note = message.data[1];
    const velocity = message.data[2];
    handleNoteOn(note, velocity);
    return;
  }
  if (CONTROL_CHANGE_CHANNEL_0 <= statusByte && statusByte < CONTROL_CHANGE_CHANNEL_0 + NUM_CHANNELS) {
    const dataByte1 = message.data[1];
    if (dataByte1 == DAMPER_PEDAL_DATA_BYTE) {
        const velocity = message.data[2];
        if (_firstPedalVelocity === null) {
          _firstPedalVelocity = velocity;
        }
        if (velocity == 0) {
          handlePedalOff(_firstPedalVelocity);
          return;
        }
        if (velocity == 127) {
          handlePedalOn(_firstPedalVelocity);
          return;
        }
    }
  }
}

function handlePedalOn(firstPedalVelocity) {
  if (firstPedalVelocity != 0) {
      _possBeatPub(Date.now());
  }
}

function handlePedalOff(firstPedalVelocity) {
  if (firstPedalVelocity == 0) {
    _possBeatPub(Date.now());
  }
}

function handleNoteOn(note, velocity) {
  if (velocity <= 0) {
    handleNoteOff(note);
  }
  const now = Date.now();
  _notedownPub([note], now);
}

function handleNoteOff(note) {
  const now = Date.now();
  _noteupPub([note], now);

}