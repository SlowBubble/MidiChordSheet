// buttons.js — button and checkbox wiring

import {
  beatsPerMeasure, beatSubdivision, lowNoteThreshold, idleMeasures,
  setBeatsPerMeasure, setBeatSubdivision, setLowNoteThreshold, setIdleMeasures,
  midiToNoteName,
} from './beatStateMgr.js';

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

export function setupButtons() {
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

  // silent-til-double-bass checkbox
  const silentCb = document.getElementById('silent-til-double-bass-cb');
  if (getUrlParam('SilentTilDoubleBass') === '1') silentCb.checked = true;
  silentCb.onchange = () => setUrlParam('SilentTilDoubleBass', silentCb.checked ? '1' : null);

  // mute-if-double-soprano checkbox
  const muteSopranoCb = document.getElementById('mute-if-double-soprano-cb');
  if (getUrlParam('MuteIfDoubleSoprano') === '1') muteSopranoCb.checked = true;
  muteSopranoCb.onchange = () => setUrlParam('MuteIfDoubleSoprano', muteSopranoCb.checked ? '1' : null);
}
