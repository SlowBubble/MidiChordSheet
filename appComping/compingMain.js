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
const dataParam = hashParams.get('data');

/** Decode a base64url-encoded recording back to an object. */
function decodeRecording(encoded) {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

setupMidiHandler();
setupKeyboardHandler(keyboardEvtSub);
setupKeyboard(keyboardEvtPub);
const sheetApi = initSheetDisplay(noteRecorder);
setSheetApi(sheetApi);
setupButtons(sheetApi);

if (recordingId) {
  const rec = noteRecorder.loadRecording(recordingId);
  if (rec) {
    noteRecorder.disable();
    noteRecorder.loadInto(rec.notes, rec.beats, rec.measureDurMs, rec.beatsPerMeasure, rec.lowNoteThreshold, rec.noteLengthDenom, rec.noteStartDenom, rec.measure1StartMs, rec.label, rec.beatSubdivision);
    const status = document.getElementById('status');
    if (status) status.textContent = `📼 ${rec.label}`;
    if (rec.beats?.length) setTimeout(() => sheetApi?.setStartCursor(rec.measure1StartMs ?? rec.beats[0].time - rec.measureDurMs), 0);
  } else {
    console.warn('[RecordingId] no recording found for id:', recordingId);
  }
} else if (dataParam) {
  const rec = decodeRecording(dataParam);
  if (rec) {
    noteRecorder.disable();
    noteRecorder.loadInto(rec.notes, rec.beats, rec.measureDurMs, rec.beatsPerMeasure, rec.lowNoteThreshold, rec.noteLengthDenom, rec.noteStartDenom, rec.measure1StartMs, rec.label, rec.beatSubdivision);
    const status = document.getElementById('status');
    if (status) status.textContent = `🔗 ${rec.label || 'Shared recording'}`;
    if (rec.beats?.length) setTimeout(() => sheetApi?.setStartCursor(rec.measure1StartMs ?? rec.beats[0].time - rec.measureDurMs), 0);
  } else {
    console.warn('[data] failed to decode recording from hash param');
  }
}
