import * as midiEvent from '../esModules/midi-data/midiEvent.js';

export class GameMgr {
  constructor({
    soundPub,
  }) {
    this.soundPub = soundPub;
    this.leftHandNoteGps = [];
    this.rightHandNoteGps = [];
    this.lastLeftHandNoteGp = null;
    this.lastRightHandNoteGp = null;
    this._oneTimeSetup();
  }
  
  resetGame(song) {
    this.leftHandIdx = 0;
    this.rightHandIdx = 0;
    this.pressedKeys = new Set();

    const rightHandVoice = song.getVoice(1);
    const leftHandVoice = song.getVoice(2);
    this.rightHandNoteGps = rightHandVoice.noteGps.filter(gp => !gp.isRest);
    this.leftHandNoteGps = leftHandVoice.noteGps.filter(gp => !gp.isRest);
  }

  isKeyPressed(key) {
    return this.pressedKeys.has(key);
  }

  /*
  Rules:
  - When the "Tab" key is pressed down (make sure to debounce so only one event per key press):
    - Look up the notes in leftHandVoice for the current leftHandIdx.
    - Play the notes
    - Increment leftHandIdx.
    - When the "\" key is pressed, do the same for rightHandVoice.
    */
  _oneTimeSetup() {
    document.addEventListener('keyup', evt => {
      if (leftHandKeys.has(evt.key) && this.lastLeftHandNoteGp) {
        this.lastLeftHandNoteGp.midiNotes.forEach(note => {
          this.soundPub(new midiEvent.NoteOffEvt({
            noteNum: note.noteNum,
            velocity: note.velocity,
            channelNum: note.channelNum || 0,
            time: Date.now(),
          }));
        });
        this.lastLeftHandNoteGp = null;
      }
      
      if (rightHandKeys.has(evt.key) && this.lastRightHandNoteGp) {
        this.lastRightHandNoteGp.midiNotes.forEach(note => {
          this.soundPub(new midiEvent.NoteOffEvt({
            noteNum: note.noteNum,
            velocity: note.velocity,
            channelNum: note.channelNum || 0,
            time: Date.now(),
          }));
        });
        this.lastRightHandNoteGp = null;
      }
      
      this.pressedKeys.delete(evt.key);
    });
    
    document.addEventListener('keydown', evt => {
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
      }
      
      if (leftHandKeys.has(evt.key) && !this.isKeyPressed(evt.key)) {
        evt.preventDefault();
        this.pressedKeys.add(evt.key);
        if (this.leftHandIdx >= this.leftHandNoteGps.length) {
          return;
        }
        const noteGp = this.leftHandNoteGps[this.leftHandIdx];
        this.lastLeftHandNoteGp = noteGp;
        noteGp.midiNotes.forEach(note => {
          this.soundPub(new midiEvent.NoteOnEvt({
            noteNum: note.noteNum,
            velocity: note.velocity,
            channelNum: note.channelNum || 0,
            time: Date.now(),
          }));
        });
        this.leftHandIdx++;
      }
      
      if (rightHandKeys.has(evt.key) && !this.isKeyPressed(evt.key)) {
        evt.preventDefault();
        this.pressedKeys.add(evt.key);
        if (this.rightHandIdx >= this.rightHandNoteGps.length) {
          return;
        }
        const noteGp = this.rightHandNoteGps[this.rightHandIdx];
        this.lastRightHandNoteGp = noteGp;
        noteGp.midiNotes.forEach(note => {
          this.soundPub(new midiEvent.NoteOnEvt({
            noteNum: note.noteNum,
            velocity: note.velocity,
            channelNum: note.channelNum || 0,
            time: Date.now(),
          }));
        });
        this.rightHandIdx++;
      }
    });
    
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
    });
  }
}

const leftHandKeys = new Set(['a', 's', 'd', 'f', '1', '2', '3', '4', '5', 'q', 'w', 'e', 'r', 't', 'z', 'x', 'c', 'v', 'g', 'b']);
const rightHandKeys = new Set(['j', 'k', 'l', ';', '7', '8', '9', '0', '-', '=', 'u', 'i', 'o', 'p', '[', ']', "'", 'n', 'm', ',', '.', '/']);