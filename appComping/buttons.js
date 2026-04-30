// buttons.js — button and checkbox wiring

import {
  beatsPerMeasure, beatSubdivision, lowNoteThreshold, idleMeasures,
  setBeatsPerMeasure, setBeatSubdivision, setLowNoteThreshold, setIdleMeasures,
  midiToNoteName,
} from './beatStateMgr.js';
import * as noteRecorder from './noteRecorder.js';

// Note-length quantization steps (denominator): 16, 8, 4, 2, 1
const NOTE_LENGTH_STEPS = [16, 8, 4, 2, 1];
let noteLengthIdx = 2; // default: 1/4

let noteStartDenom = 16; // default: 1/16

let snapBiasPct = 51; // default: 51%

export function getNoteLengthDenom() {
  return NOTE_LENGTH_STEPS[noteLengthIdx];
}

export function setNoteLengthDenom(denom) {
  const idx = NOTE_LENGTH_STEPS.indexOf(denom);
  if (idx !== -1) { noteLengthIdx = idx; noteRecorder.setNoteLengthDenom(denom); }
}

function getUrlParam(key) {
  return new URLSearchParams(window.location.hash.slice(1)).get(key);
}

function setUrlParam(key, val) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (val !== undefined && val !== null) { params.set(key, val); } else { params.delete(key); }
  const newHash = params.toString();
  history.replaceState(null, '', newHash ? '#' + newHash : window.location.pathname);
}

function updateBeatsDisplay() {
  document.getElementById('beats-display').textContent = beatsPerMeasure;
}
function updateSubdivDisplay() {
  document.getElementById('subdiv-display').textContent = beatSubdivision;
}
function updateThresholdDisplay() {
  document.getElementById('threshold-display').textContent = midiToNoteName(lowNoteThreshold);
}
function updateIdleMeasuresDisplay() {
  document.getElementById('idle-measures-display').textContent = idleMeasures;
}

export function setupButtons(sheetApi) {
  // beats per measure
  document.getElementById('incr-beats-btn').onclick = () => { setBeatsPerMeasure(beatsPerMeasure + 1); updateBeatsDisplay(); };
  document.getElementById('decr-beats-btn').onclick = () => { if (beatsPerMeasure > 1) { setBeatsPerMeasure(beatsPerMeasure - 1); updateBeatsDisplay(); } };

  // subdivision
  document.getElementById('incr-subdiv-btn').onclick = () => { setBeatSubdivision(beatSubdivision + 1); updateSubdivDisplay(); };
  document.getElementById('decr-subdiv-btn').onclick = () => { if (beatSubdivision > 1) { setBeatSubdivision(beatSubdivision - 1); updateSubdivDisplay(); } };

  // low-note threshold
  document.getElementById('incr-threshold-btn').onclick = () => { setLowNoteThreshold(lowNoteThreshold + 1); updateThresholdDisplay(); };
  document.getElementById('decr-threshold-btn').onclick = () => { if (lowNoteThreshold > 1) { setLowNoteThreshold(lowNoteThreshold - 1); updateThresholdDisplay(); } };

  // idle measures
  document.getElementById('incr-idle-btn').onclick = () => { setIdleMeasures(idleMeasures + 1); updateIdleMeasuresDisplay(); };
  document.getElementById('decr-idle-btn').onclick = () => { if (idleMeasures > 1) { setIdleMeasures(idleMeasures - 1); updateIdleMeasuresDisplay(); } };

  // note length (off-quantization)
  function updateNoteLengthDisplay() {
    document.getElementById('note-length-display').textContent = `1/${NOTE_LENGTH_STEPS[noteLengthIdx]}`;
  }
  document.getElementById('incr-note-length-btn').onclick = () => {
    if (noteLengthIdx < NOTE_LENGTH_STEPS.length - 1) { noteLengthIdx++; noteRecorder.setNoteLengthDenom(NOTE_LENGTH_STEPS[noteLengthIdx]); updateNoteLengthDisplay(); }
  };
  document.getElementById('decr-note-length-btn').onclick = () => {
    if (noteLengthIdx > 0) { noteLengthIdx--; noteRecorder.setNoteLengthDenom(NOTE_LENGTH_STEPS[noteLengthIdx]); updateNoteLengthDisplay(); }
  };

  // note start quantization
  function updateNoteStartDisplay() {
    document.getElementById('note-start-display').textContent = `1/${noteStartDenom}`;
  }
  document.getElementById('incr-note-start-btn').onclick = () => {
    noteStartDenom++; noteRecorder.setNoteStartDenom(noteStartDenom); updateNoteStartDisplay();
  };
  document.getElementById('decr-note-start-btn').onclick = () => {
    if (noteStartDenom > 1) { noteStartDenom--; noteRecorder.setNoteStartDenom(noteStartDenom); updateNoteStartDisplay(); }
  };

  // snap bias
  function updateSnapBiasDisplay() {
    document.getElementById('snap-bias-display').textContent = `${snapBiasPct}%`;
  }
  document.getElementById('incr-snap-bias-btn').onclick = () => {
    if (snapBiasPct < 100) { snapBiasPct = Math.min(100, snapBiasPct + 5); noteRecorder.setSnapBias(snapBiasPct / 100); updateSnapBiasDisplay(); sheetApi?.rerender(); }
  };
  document.getElementById('decr-snap-bias-btn').onclick = () => {
    if (snapBiasPct > 0) { snapBiasPct = Math.max(0, snapBiasPct - 5); noteRecorder.setSnapBias(snapBiasPct / 100); updateSnapBiasDisplay(); sheetApi?.rerender(); }
  };

  // render lag
  function updateRenderLagDisplay() {
    document.getElementById('render-lag-display').textContent = sheetApi?.getRenderLag() ?? 1;
  }
  document.getElementById('incr-render-lag-btn').onclick = () => { sheetApi?.setRenderLag((sheetApi?.getRenderLag() ?? 1) + 1); updateRenderLagDisplay(); };
  document.getElementById('decr-render-lag-btn').onclick = () => { if ((sheetApi?.getRenderLag() ?? 1) > 1) { sheetApi?.setRenderLag((sheetApi?.getRenderLag() ?? 1) - 1); updateRenderLagDisplay(); } };

  // silent-til-double-bass checkbox
  const silentCb = document.getElementById('silent-til-double-bass-cb');
  if (getUrlParam('SilentTilDoubleBass') === '1') silentCb.checked = true;
  silentCb.onchange = () => setUrlParam('SilentTilDoubleBass', silentCb.checked ? '1' : null);

  // mute-if-double-soprano checkbox
  const muteSopranoCb = document.getElementById('mute-if-double-soprano-cb');
  if (getUrlParam('MuteIfDoubleSoprano') === '1') muteSopranoCb.checked = true;
  muteSopranoCb.onchange = () => setUrlParam('MuteIfDoubleSoprano', muteSopranoCb.checked ? '1' : null);

  // disable-drumbeat checkbox
  const disableDrumbeatCb = document.getElementById('disable-drumbeat-cb');
  if (getUrlParam('DisableDrumbeat') === '1') disableDrumbeatCb.checked = true;
  disableDrumbeatCb.onchange = () => setUrlParam('DisableDrumbeat', disableDrumbeatCb.checked ? '1' : null);

  // no-replay-drumbeat checkbox
  const noReplayDrumbeatCb = document.getElementById('no-replay-drumbeat-cb');
  if (getUrlParam('NoReplayDrumbeat') === '1') noReplayDrumbeatCb.checked = true;
  noReplayDrumbeatCb.onchange = () => setUrlParam('NoReplayDrumbeat', noReplayDrumbeatCb.checked ? '1' : null);
}
