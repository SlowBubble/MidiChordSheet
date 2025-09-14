import * as state from '../fire/state.js';
import * as banner from '../fire/banner.js';

export class RenderMgr {
  constructor(canvasDiv) {
    this._eBanner = new banner.EphemeralBanner();
    this._canvasDiv = canvasDiv;
  }

  render(song, displayComping=false, sheetStart8n=null, cursorTime8n=null) {
    const stateMgr = new state.StateMgr(this._eBanner);
    stateMgr.doc.timeSigNumer = song.timeSigChanges.defaultVal.upperNumeral;
    stateMgr.doc.timeSigDenom = song.timeSigChanges.defaultVal.lowerNumeral;
    stateMgr.setTitle(song.title);
    if (!sheetStart8n) {
      stateMgr.setPickup(song.pickup8n.over(8).negative());
    }
    stateMgr.setTempo(song.tempo8nPerMinChanges.defaultVal);
    stateMgr.doc.tempoStr = song.swingChanges.defaultVal.ratio.toFloat() > 1 ? 'Swing' : '';
    stateMgr.doc.keySigSp = song.keySigChanges.defaultVal;
    
    stateMgr.doc.voices = [];
    const displayedVoices = displayComping ? song.getInvisibleVoices() : song.getVisibleVoices();
    displayedVoices.forEach((voice, idx) => {
      if (idx >= stateMgr.doc.voices.length) {
        stateMgr.addVoice(new state.Voice(null, voice.clef.toLowerCase()));
      }
      stateMgr.disableChordMode();
      stateMgr.setVoiceIdx(idx);
      stateMgr.navHead();
      voice.noteGps.filter(qng => !sheetStart8n || qng.start8n.geq(sheetStart8n)).forEach(qng => {
        const noteNums = qng.getNoteNums();
        stateMgr.upsertByDur(noteNums.length ? qng.getNoteNums() : [null], qng.end8n.minus(qng.start8n).over(8));
      });
    });

    stateMgr.enableChordMode();
    song.chordChanges.getChanges().filter(chordChange => !sheetStart8n || chordChange.start8n.geq(sheetStart8n)).forEach(chordChange => {
      let cursorTime = chordChange.start8n.over(8);
      if (sheetStart8n) {
        cursorTime = cursorTime.minus(sheetStart8n.over(8));
      }
      stateMgr.setCursorTimeSyncPointer(cursorTime);
      stateMgr.insertChord(chordChange.val.toString().replace('maj', 'M'));
    });

    // Configure the cursor.
    stateMgr.viewMode = false;
    stateMgr.editor.cursorOnChords = true;
    if (cursorTime8n && sheetStart8n) {
      stateMgr.editor.cursorTime = cursorTime8n.minus(sheetStart8n).over(8);
    }

    const params = {};
    const moreParams = {};
    const abcStr = stateMgr.getAbc();
    ABCJS.renderAbc(this._canvasDiv, abcStr, params, moreParams);
  }

  clear() {
    this._canvasDiv.innerHTML = '';
    this._canvasDiv.removeAttribute("style");
  }
  
}