// Actions should contain the exact method and args to call
// on state.Manager, as well as the reverse method and args.

import * as storage from './storage.js';
import * as undoStorage from './undoStorage.js';

export class ActionMgr {
  constructor(eBanner, stateMgr, renderPub, execPub, execSub, shadowRoot) {
    this.eBanner = eBanner;
    this.stateMgr = stateMgr;
    this.shadowRoot = shadowRoot;
    // This is for signalling re-rendering
    this.renderPub = renderPub;
    // This is for signalling storing undo-redo history + for re-rendering.
    this.execPub = execPub;
    execSub(_ => {
      if (!stateMgr.viewMode) {
        undoStorage.record(this.stateMgr);
      }
      this.renderPub();
    });

    this.loadFromStorage();
  }

  async loadFromStorage() {
    const json = await storage.retrieve(this.stateMgr.urlId);
    if (json) {
      this.stateMgr.loadJson(json);
    }
    this.stateMgr.disableChordMode();
    this.stateMgr.setVoiceIdx(0);
    this.stateMgr.navHead();
    // Initial state for undoStorage.
    undoStorage.record(this.stateMgr);
    this.renderPub();
  }

  undo() {
    const json = undoStorage.undo();
    if (!json) {
      return;
    }
    this.stateMgr.loadJson(json);
    this.renderPub();
  }
  redo() {
    const json = undoStorage.redo();
    if (!json) {
      return;
    }
    this.stateMgr.loadJson(json);
    this.renderPub();
  }

  exec(actionFunc, delay) {
    if (actionFunc) {
      actionFunc();
    }
    if (!delay) {
      this.execPub();
      return;
    }
    window.setTimeout(_ => {
      this.execPub();
    }, delay);
  }

  incrStep() {
    this.exec(_ => {
      this.eBanner.display(`Step: ${this.stateMgr.incrStep()}`);
    });
  }
  decrStep() {
    this.exec(_ => {
      this.eBanner.display(`Step: ${this.stateMgr.decrStep()}`);
    });
  }

  updateLyrics() {
    const lyricsString = prompt('Lyrics (use " _ " to denote blanks.)', this.stateMgr.getLyricsString());
    if (lyricsString === null) {
      return;
    }
    this.exec(_ => {
      this.stateMgr.updateLyrics(lyricsString);
    });
  }

  addVoice() {
    this.exec(_ => {
      this.stateMgr.addVoice();
    });
  }
  removeVoice() {
    this.exec(_ => {
      this.stateMgr.removeVoice();
    });
  }

  quantize() {
    this.exec(_ => {
      this.stateMgr.quantize();
    });
  }

  toggleDisplayMelodyOnly() {
    this.exec(_ => {
      this.stateMgr.toggleDisplayMelodyOnly();
    });
  }
  toggleDisplayLyrics() {
    this.exec(_ => {
      this.stateMgr.toggleDisplayLyrics();
    });
  }

  insertGraceNote() {
    this.exec(_ => {
      this.stateMgr.insertGraceNote();
    });
  }

  swingify() {
    this.exec(_ => {
      this.stateMgr.swingify();
    });
  }

  implicitSwing() {
    this.exec(_ => {
      this.stateMgr.implicitSwing();
    });
  }

  shiftNoteGpBoundary(arg) {
    this.exec(_ => {
      this.stateMgr.shiftNoteGpBoundary(arg);
    });
  }

  enharmSpelling() {
    const spellingsStr = prompt('Note Spelling (delimit by comma if more than 1 notes).');
    if (spellingsStr === null) {
      return;
    }
    this.exec(_ => {
      this.stateMgr.enharmSpelling(spellingsStr);
    });
  }

  incrNoteNumShift() {
    this.exec(_ => {
      this.eBanner.display(`Note number shift: ${this.stateMgr.incrNoteNumShift()}`);
    });
  }

  decrNoteNumShift() {
    this.exec(_ => {
      this.eBanner.display(`Note number shift: ${this.stateMgr.decrNoteNumShift()}`);
    });
  }

  addSimpleComping() {
    this.exec(_ => {
      this.stateMgr.addSimpleComping();
    });
  }

  addOneBeatComping() {
    this.exec(_ => {
      this.stateMgr.addOneBeatComping();
    });
  }

  addFingerStyleComping() {
    this.exec(_ => {
      this.stateMgr.addFingerStyleComping();
    });
  }

  addMelodicComping() {
    this.exec(_ => {
      this.stateMgr.addMelodicComping();
    });
  }

  addSimpleBass() {
    this.exec(_ => {
      this.stateMgr.addSimpleBass();
    });
  }

  addTwoBeatBass() {
    this.exec(_ => {
      this.stateMgr.addTwoBeatBass();
    });
  }

  addBossaNovaBass() {
    this.exec(_ => {
      this.stateMgr.addBossaNovaBass();
    });
  }

  addBossaNovaComping() {
    this.exec(_ => {
      this.stateMgr.addBossaNovaComping();
    });
  }

  toggleShowSpelling() {
    this.exec(_ => {
      this.stateMgr.toggleShowSpelling();
    });
  }

  toggleClef() {
    this.exec(_ => {
      this.stateMgr.toggleClef();
    });
  }

  incrTimeSigNumer() {
    this.exec(_ => {
      this.stateMgr.incrTimeSigNumer();
    });
  }

  decrTimeSigNumer() {
    this.exec(_ => {
      this.stateMgr.decrTimeSigNumer();
    });
  }

  incrTimeSigDenom() {
    this.exec(_ => {
      this.stateMgr.incrTimeSigDenom();
    });
  }

  decrTimeSigDenom() {
    this.exec(_ => {
      this.stateMgr.decrTimeSigDenom();
    });
  }

  exportAbc() {
    const blob = new Blob([this.stateMgr.getAbc()], {type:"text/plain;charset=utf-8"});
    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = blobUrl;
    const date = (new Date).toLocaleString().replace(/ /g, '').replace(/[^a-zA-Z\d]/g, '-')
    downloadLink.download = `${this.stateMgr.doc.title}-${date}.abc`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  setKeySig() {
    this.exec(_ => {
      const chordStr = prompt('Key signature', this.stateMgr.getKeySig().toString());
      this.stateMgr.setKeySigFromStr(chordStr);
    });
  }

  transpose() {
    this.exec(_ => {
      const chordStr = prompt('The key to shift to.', this.stateMgr.getKeySig().toString())
      const shiftUp = parseInt(prompt('Number of octaves to shift up by.', '0'));
      this.stateMgr.shiftToKey(chordStr, isNaN(shiftUp) ? 0 : shiftUp);
    });
  }

  incrPickup() {
    this.exec(_ => {
      this.stateMgr.incrPickup();
    });
  }

  decrPickup() {
    this.exec(_ => {
      this.stateMgr.decrPickup();
    });
  }

  setTempo() {
    const tempo = parseInt(window.prompt('Tempo', this.stateMgr.getTempo()));
    if (isNaN(tempo)) {
      return;
    }
    this.exec(_ => {
      this.stateMgr.setTempo(tempo);
    });
  }

  toggle24And44() {
    this.exec(_ => {
      this.stateMgr.toggle24And44();
    });
  }
}
