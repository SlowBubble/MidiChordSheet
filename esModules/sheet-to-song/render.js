import * as state from '../fire/state.js';
import * as banner from '../fire/banner.js';

export class RenderMgr {
  constructor(canvasDiv) {
    this._eBanner = new banner.EphemeralBanner();
    this._canvasDiv = canvasDiv;
  }

  render(song) {
    const stateMgr = new state.StateMgr(this._eBanner);
    stateMgr.doc.timeSigNumer = song.timeSigChanges.defaultVal.upperNumeral;
    stateMgr.doc.timeSigDenom = song.timeSigChanges.defaultVal.lowerNumeral;
    stateMgr.setTitle(song.title);
    stateMgr.setPickup(song.pickup8n.over(8).negative());
    stateMgr.setTempo(song.tempo8nPerMinChanges.defaultVal);
    stateMgr.doc.tempoStr = song.swingChanges.defaultVal.ratio.toFloat() > 1 ? 'Swing' : '';
    stateMgr.doc.keySigSp = song.keySigChanges.defaultVal;
    
    stateMgr.doc.voices = [];
    song.getVisibleVoices().forEach((voice, idx) => {
      if (idx >= stateMgr.doc.voices.length) {
        stateMgr.addVoice(new state.Voice(null, voice.clef.toLowerCase()));
      }
      stateMgr.disableChordMode();
      stateMgr.setVoiceIdx(idx);
      stateMgr.navHead();
      voice.noteGps.forEach(qng => {
        const noteNums = qng.getNoteNums();
        stateMgr.upsertByDur(noteNums.length ? qng.getNoteNums() : [null], qng.end8n.minus(qng.start8n).over(8));
      });
    });

    stateMgr.enableChordMode();
    song.chordChanges.getChanges().forEach(chordChange => {
      stateMgr.setCursorTimeSyncPointer(chordChange.start8n.over(8));
      stateMgr.insertChord(chordChange.val.toString().replace('maj', 'M'));
    });

    stateMgr.viewMode = true;

    const params = {};
    const moreParams = {};
    const abcStr = stateMgr.getAbc();
    ABCJS.renderAbc(this._canvasDiv, abcStr, params, moreParams);
  }
  
}