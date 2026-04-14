// sound.js — dumb MIDI wrapper. No app logic, no state imports.

const soundfontUrl = '../lib/midi.js/soundfont/';
let midiReady = false;
let midiLoaded = false;

export function initMidi(volume, onReady) {
  if (midiReady) return;
  midiReady = true;

  const statusEl = document.getElementById('status');
  statusEl.textContent = '🔴 Loading audio...';

  MIDI.loadPlugin({
    soundfontUrl,
    instruments: ['acoustic_grand_piano', 'synth_drum'],
    onsuccess: () => {
      MIDI.setVolume(0, volume);
      MIDI.programChange(1, MIDI.GM.byName['acoustic_grand_piano'].number);
      MIDI.programChange(2, MIDI.GM.byName['synth_drum'].number);
      MIDI.setVolume(2, volume);
      statusEl.textContent = 'Audio: ready ✓';
      statusEl.className = 'status status-green';
      midiLoaded = true;
      onReady();
    },
  });
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
