import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';

import { setupButtons } from './buttons.js';
import { setupKeyboardHandler } from './keyboardHandler.js';
import { setupMidiHandler } from './midiHandler.js';
import * as noteRecorder from './noteRecorder.js';
import { init as initSheetDisplay } from './sheetDisplay.js';
import * as beatStateMgr from './beatStateMgr.js';
import { setSheetApi } from './replay.js';

const [keyboardEvtPub, keyboardEvtSub] = pubSub.make();

const hashParams = new URLSearchParams(window.location.hash.slice(1));
const recordingId = hashParams.get('RecordingId');

setupButtons();
setupMidiHandler();
setupKeyboardHandler(keyboardEvtSub);
setupKeyboard(keyboardEvtPub);
const sheetApi = initSheetDisplay(noteRecorder);
setSheetApi(sheetApi);

if (recordingId) {
  const rec = noteRecorder.loadRecording(recordingId);
  if (rec) {
    noteRecorder.disable();
    noteRecorder.loadInto(rec.notes, rec.beats, rec.measureDurMs, rec.beatsPerMeasure, rec.lowNoteThreshold, rec.noteLengthDenom);
    const status = document.getElementById('status');
    if (status) status.textContent = `📼 ${rec.label}`;
  } else {
    console.warn('[RecordingId] no recording found for id:', recordingId);
  }
}
