// sound.js — dumb MIDI wrapper. No app logic, no state imports.

const soundfontUrl = '../lib/midi.js/soundfont/';
let midiReady = false;
let midiLoaded = false;
const _onLoadedCallbacks = [];

export function initMidi(volume, onReady) {
  if (midiReady) {
    if (midiLoaded) onReady();
    else _onLoadedCallbacks.push(onReady);
    return;
  }
  midiReady = true;
  _onLoadedCallbacks.push(onReady);

  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Press space to load audio';
  statusEl.className = 'status status-orange';

  MIDI.loadPlugin({
    soundfontUrl,
    instruments: ['acoustic_grand_piano', 'synth_drum'],
    onsuccess: () => {
      MIDI.setVolume(0, volume);
      MIDI.programChange(1, MIDI.GM.byName['acoustic_grand_piano'].number);
      MIDI.programChange(2, MIDI.GM.byName['synth_drum'].number);
      MIDI.setVolume(2, volume);
      midiLoaded = true;
      _onLoadedCallbacks.forEach(cb => cb());
      _onLoadedCallbacks.length = 0;
    },
  });
}

/** Call fn immediately if MIDI is loaded, otherwise queue it for when it is. */
export function whenMidiReady(fn) {
  if (midiLoaded) { fn(); return; }
  _onLoadedCallbacks.push(fn);
}

export function pianoNoteOn(noteNum, velocity) {
  if (!midiLoaded) return;
  MIDI.noteOn(1, noteNum, velocity);
}

export function pianoNoteOff(noteNum) {
  if (!midiLoaded) return;
  MIDI.noteOff(1, noteNum);
}

export function drumNoteOn(noteNum, velocity) {
  if (!midiLoaded) return;
  MIDI.noteOn(2, noteNum, velocity);
}
