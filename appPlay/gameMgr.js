import { makeFrac } from '../esModules/fraction/fraction.js';
import * as midiEvent from '../esModules/midi-data/midiEvent.js';

// For debugging, log: console.log('[L] diff', diff.toFixed(2));
class GameScore {
  constructor() {
    this.numAttemptedLeftHandNotes = 0;
    this.numAttemptedLeftHandNotesOnTime = 0;
    this.numAttemptedRightHandNotes = 0;
    this.numAttemptedRightHandNotesOnTime = 0;
    // this.numRequiredBassNotes = 0;
    // this.numRequiredBassNotesOnTime = 0;
  }
  reset() {
    this.numAttemptedLeftHandNotes = 0;
    this.numAttemptedLeftHandNotesOnTime = 0;
    this.numAttemptedRightHandNotes = 0;
    this.numAttemptedRightHandNotesOnTime = 0;
    // this.numRequiredBassNotes = 0;
    // this.numRequiredBassNotesOnTime = 0;
  }
}

export class GameMgr {
  constructor({
    soundPub,
    metronomeBeatSub,
    eBanner,
    smartMode = true,
  }) {
    this.soundPub = soundPub;
    this.eBanner = eBanner;
    /*
    Smart mode will move the indexes smartly between key down and NoteOn  
    - First, chunk the noteGps for each hand by chord change
    - On key down for a hand, before creating a NoteOn event
      - If currTime > nextChordChangeTime - (ms of a 16th note), update the index to the next chunk.
        - Estimate ms of a 16th note via this.msPer8n / 2
        - Do something special for songs that swings.
      - Then create the NoteOn event
      - Then increment the index (but looping within the chunk).
    */
    this.smartMode = smartMode;
    this.leftHandNoteGps = [];
    this.rightHandNoteGps = [];
    this.leftHandChunks = [];
    this.rightHandChunks = [];
    this.leftHandChunkIdx = 0;
    this.rightHandChunkIdx = 0;
    this.leftHandIdxInChunk = 0;
    this.rightHandIdxInChunk = 0;
    this.evtKeyToLeftHandNoteGp = new Map();
    this.evtKeyToRightHandNoteGp = new Map();
    this.gameScore = new GameScore();
    // TODO decide if ms is easier to work with especially for swing.
    this.onTimeMargin8nFloat = 0.25; // i.e. a 32-th note.

    this.currTime8n = makeFrac(0);
    this.timeOfLastBeat = Date.now();
    this.msPer4n = null;
    metronomeBeatSub(beat => {
      this.currTime8n = beat.time8n;
      // 4n because each beat is a quarter note
      this.msPer4n = (beat.time - this.timeOfLastBeat);
      this.timeOfLastBeat = beat.time;
    })
    this._oneTimeSetup();
  }
  _getCurrTime8nInFloat() {
    if (this.msPer4n === null) {
      return this.currTime8n.toFloat();
    }
    // Multiply by 2 because ms * msPer4n = quarter notes, but we want to convert to eighth notes.
    return this.currTime8n.toFloat() + (Date.now() - this.timeOfLastBeat) / this.msPer4n * 2;
  }
  
  resetGame(song) {
    this.leftHandIdx = 0;
    this.rightHandIdx = 0;
    this.pressedKeys = new Set();

    const rightHandVoice = song.getVoice(1);
    const leftHandVoice = song.getVoice(2);
    this.rightHandNoteGps = rightHandVoice.noteGps.filter(gp => !gp.isRest);
    this.leftHandNoteGps = leftHandVoice.noteGps.filter(gp => !gp.isRest);
    this.evtKeyToLeftHandNoteGp.clear();
    this.evtKeyToRightHandNoteGp.clear();

    this.leftHandChunkIdx = 0;
    this.rightHandChunkIdx = 0;
    this.leftHandIdxInChunk = 0;
    this.rightHandIdxInChunk = 0;
    this.leftHandChunkFinished = false;
    this.rightHandChunkFinished = false;
    if (this.smartMode) {
      this.leftHandChunks = this._chunkNoteGpsByChord(song, this.leftHandNoteGps);
      this.rightHandChunks = this._chunkNoteGpsByChord(song, this.rightHandNoteGps);
    }
    this.gameScore.reset();
  }

  getScoreLine() {
    return `${this.gameScore.numAttemptedLeftHandNotesOnTime} / ${this.gameScore.numAttemptedLeftHandNotes}`;
  }
  _chunkNoteGpsByChord(song, noteGps) {
    const chordChanges = song.chordChanges.getChanges();
    if (!chordChanges.length) return [{ chord: null, chunk: noteGps, start8n: noteGps.length ? noteGps[0].start8n : null }];
    const chunks = [];
    for (let i = 0; i < chordChanges.length; i++) {
      const start8n = chordChanges[i].start8n;
      const end8n = chordChanges[i + 1] ? chordChanges[i + 1].start8n : null;
      const chunk = noteGps.filter(gp => {
        if (end8n) {
          return gp.start8n.geq(start8n) && gp.start8n.lessThan(end8n);
        }
        return gp.start8n.geq(start8n);
      });
      chunks.push({ chord: chordChanges[i].val, chunk, start8n });
    }
    return chunks;
  }

  isKeyPressed(key) {
    return this.pressedKeys.has(key);
  }

  _findActiveNoteGpsForNoteNum(noteNum) {
    const noteGps = [];
    for (const [key, noteGp] of this.evtKeyToLeftHandNoteGp) {
      if (noteGp.midiNotes.some(note => note.noteNum === noteNum)) {
        noteGps.push(noteGp);
      }
    }
    for (const [key, noteGp] of this.evtKeyToRightHandNoteGp) {
      if (noteGp.midiNotes.some(note => note.noteNum === noteNum)) {
        noteGps.push(noteGp);
      }
    }
    return noteGps;
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
      if (leftHandKeys.has(evt.key)) {
        const noteGp = this.evtKeyToLeftHandNoteGp.get(evt.key);
        if (noteGp) {
          noteGp.midiNotes.forEach(note => {
            // Only send NoteOff if this is the last key playing this note
            const activeNoteGps = this._findActiveNoteGpsForNoteNum(note.noteNum);
            if (activeNoteGps.length === 1) {
              this.soundPub(new midiEvent.NoteOffEvt({
                noteNum: note.noteNum,
                velocity: note.velocity,
                channelNum: note.channelNum || 0,
                time: Date.now(),
              }));
            }
          });
          this.evtKeyToLeftHandNoteGp.delete(evt.key);
        }
      }
      
      if (rightHandKeys.has(evt.key)) {
        const noteGp = this.evtKeyToRightHandNoteGp.get(evt.key);
        if (noteGp) {
          noteGp.midiNotes.forEach(note => {
            // Only send NoteOff if this is the last key playing this note
            const activeNoteGps = this._findActiveNoteGpsForNoteNum(note.noteNum);
            if (activeNoteGps.length === 1) {
              this.soundPub(new midiEvent.NoteOffEvt({
                noteNum: note.noteNum,
                velocity: note.velocity,
                channelNum: note.channelNum || 0,
                time: Date.now(),
              }));
            }
          });
          this.evtKeyToRightHandNoteGp.delete(evt.key);
        }
      }
      
      this.pressedKeys.delete(evt.key);
    });
    
    document.addEventListener('keydown', evt => {
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        return;
      }
      // Smart mode logic for left hand
      if (leftHandKeys.has(evt.key) && !this.isKeyPressed(evt.key)) {
        evt.preventDefault();
        this.pressedKeys.add(evt.key);

        if (this.smartMode) {
          const chunks = this.leftHandChunks;
          if (!chunks.length) return;
          let currChunkIdx = this.leftHandChunkIdx;
          // TODO for swing ratio 2, need to multiply via 0.5 * 2/3 = 0.33
          let margin8n = 0.5;
          if (this.leftHandChunkFinished) {
            // TODO for swing ratio 2, need to multiply via 1 * 2/3 + 0.2 * 4/3 = 0.933
            margin8n = 1.2;
          }
          // if (currChunkIdx + 1 < chunks.length) {
          //   const actualMargin = (chunks[currChunkIdx + 1].start8n.toFloat() - this._getCurrTime8nInFloat()).toFixed(2);
          //   if (margin8n <= actualMargin) {
          //     console.log('[L] same chord because margin8n <= actualMargin:', margin8n, actualMargin);
          //   }
          // }
          while (
            currChunkIdx + 1 < chunks.length &&
            this._getCurrTime8nInFloat() > chunks[currChunkIdx + 1].start8n.toFloat() - margin8n
          ) {
            currChunkIdx++;
            this.leftHandIdxInChunk = 0;
            this.leftHandChunkFinished = false;
          }
          this.leftHandChunkIdx = currChunkIdx;
          const currChunkObj = chunks[currChunkIdx];
          const currChunk = currChunkObj.chunk;
          if (!currChunk || !currChunk.length) return;
          const currIdxInChunk = this.leftHandIdxInChunk;
          const noteGp = currChunk[currIdxInChunk];
          if (!noteGp) return;
          if (!this.leftHandChunkFinished) {
            this.gameScore.numAttemptedLeftHandNotes++;
            const diff = this._getCurrTime8nInFloat() - noteGp.start8n.toFloat();
            let logColor = 'red';
            let mistake = '';
            if (Math.abs(diff) <= this.onTimeMargin8nFloat) {
              this.gameScore.numAttemptedLeftHandNotesOnTime++;
              logColor = 'green';
            } else {
              mistake = diff > 0 ? ' (too late)' : ' (too early)';
            }
            console.log(
              `%c [L] score: ${this.gameScore.numAttemptedLeftHandNotesOnTime} / ${this.gameScore.numAttemptedLeftHandNotes} ${mistake}`,
              `background: ${logColor}; color: white;`);
          }
          if (currChunkIdx + 1 === chunks.length) {
            window.setTimeout(() => {
              console.log(
                `%c Final score:\n[L] ${(this.gameScore.numAttemptedLeftHandNotesOnTime / this.leftHandNoteGps.length * 100).toFixed(0)}% | [R] ${(this.gameScore.numAttemptedRightHandNotesOnTime / this.rightHandNoteGps.length * 100).toFixed(0)}%`,
                `background: black; color: white;`
              );
            }, 1000);
          }
          // console.log('[L]', this.leftHandChunkIdx, currChunkObj.chord ? currChunkObj.chord.toString() : '(no chord)');
          this.evtKeyToLeftHandNoteGp.set(evt.key, noteGp);
          noteGp.midiNotes.forEach(note => {
            this.soundPub(new midiEvent.NoteOnEvt({
              noteNum: note.noteNum,
              velocity: note.velocity,
              channelNum: note.channelNum || 0,
              time: Date.now(),
            }));
          });
          this.leftHandIdxInChunk = (currIdxInChunk + 1) % currChunk.length;
          if (this.leftHandIdxInChunk === 0) {
            this.leftHandChunkFinished = true;
          }
        } else {
          if (this.leftHandIdx >= this.leftHandNoteGps.length) {
            return;
          }
          const noteGp = this.leftHandNoteGps[this.leftHandIdx];
          this.evtKeyToLeftHandNoteGp.set(evt.key, noteGp);
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
      }
      // Smart mode logic for right hand
      if (rightHandKeys.has(evt.key) && !this.isKeyPressed(evt.key)) {
        evt.preventDefault();
        this.pressedKeys.add(evt.key);

        if (this.smartMode) {
          const chunks = this.rightHandChunks;
          if (!chunks.length) return;
          let currChunkIdx = this.rightHandChunkIdx;
          let margin8n = 0.5;
          if (this.rightHandChunkFinished) {
            margin8n = 1.2;
          }
          // if (currChunkIdx + 1 < chunks.length) {
          //   const actualMargin = (chunks[currChunkIdx + 1].start8n.toFloat() - this._getCurrTime8nInFloat()).toFixed(2);
          //   if (margin8n <= actualMargin) {
          //     console.log('[R] same chord because margin8n <= actualMargin:', margin8n, actualMargin);
          //   }
          // }
          while (
            currChunkIdx + 1 < chunks.length &&
            this._getCurrTime8nInFloat() > chunks[currChunkIdx + 1].start8n.toFloat() - margin8n
          ) {
            currChunkIdx++;
            this.rightHandIdxInChunk = 0;
            this.rightHandChunkFinished = false;
          }
          this.rightHandChunkIdx = currChunkIdx;
          const currChunkObj = chunks[currChunkIdx];
          const currChunk = currChunkObj.chunk;
          if (!currChunk || !currChunk.length) return;
          const currIdxInChunk = this.rightHandIdxInChunk;
          const noteGp = currChunk[currIdxInChunk];
          if (!noteGp) return;
          if (!this.rightHandChunkFinished) {
            this.gameScore.numAttemptedRightHandNotes++;
            const diff = this._getCurrTime8nInFloat() - noteGp.start8n.toFloat();
            let logColor = 'red';
            let mistake = '';
            if (Math.abs(diff) <= this.onTimeMargin8nFloat) {
              this.gameScore.numAttemptedRightHandNotesOnTime++;
              logColor = 'green';
            } else {
              mistake = diff > 0 ? ' (too late)' : ' (too early)';
            }
            console.log(
              `%c [R] score: ${this.gameScore.numAttemptedRightHandNotesOnTime} / ${this.gameScore.numAttemptedRightHandNotes} ${mistake}`,
              `color: ${logColor};`);
          }
          // console.log('[R]', this.rightHandChunkIdx, currChunkObj.chord ? currChunkObj.chord.toString() : '(no chord)');
          this.evtKeyToRightHandNoteGp.set(evt.key, noteGp);
          noteGp.midiNotes.forEach(note => {
            this.soundPub(new midiEvent.NoteOnEvt({
              noteNum: note.noteNum,
              velocity: note.velocity,
              channelNum: note.channelNum || 0,
              time: Date.now(),
            }));
          });
          this.rightHandIdxInChunk = (currIdxInChunk + 1) % currChunk.length;
          if (this.rightHandIdxInChunk === 0) {
            this.rightHandChunkFinished = true;
          }
        } else {
          if (this.rightHandIdx >= this.rightHandNoteGps.length) {
            return;
          }
          const noteGp = this.rightHandNoteGps[this.rightHandIdx];
          this.evtKeyToRightHandNoteGp.set(evt.key, noteGp);
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
      }
    });
    
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
    });
  }
}

const leftHandKeys = new Set(['a', 's', 'd', 'f', '1', '2', '3', '4', '5', 'q', 'w', 'e', 'r', 't', 'z', 'x', 'c', 'v', 'g', 'b']);
const rightHandKeys = new Set(['j', 'k', 'l', ';', '7', '8', '9', '0', '-', '=', 'u', 'i', 'o', 'p', '[', ']', "'", 'n', 'm', ',', '.', '/', '6', 'y', 'h']);