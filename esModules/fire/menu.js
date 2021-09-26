import * as mobile from './mobile.js';

export function setup(shadowRoot, actionMgr, stateMgr) {
  shadowRoot.querySelector('#append-part').onclick = _ => {
    const link = prompt('Enter link of the song.');
    if (link) {
      stateMgr.appendPart(link);
    }
  }
  shadowRoot.querySelector('#reload-parts').onclick = _ => {
    stateMgr.loadParts(true);
  }

  shadowRoot.querySelector('#add-voice').onclick = _ => {
    actionMgr.addVoice();
  };
  shadowRoot.querySelector('#remove-voice').onclick = _ => {
    actionMgr.removeVoice();
  };

  shadowRoot.querySelector('#toggle-view').onclick = _ => {
    stateMgr.toggleView();
  };
  shadowRoot.querySelector('#toggle-melody').onclick = _ => {
    actionMgr.toggleDisplayMelodyOnly();
  };
  shadowRoot.querySelector('#toggle-lyrics').onclick = _ => {
    actionMgr.toggleDisplayLyrics();
  };
  shadowRoot.querySelector('#toggle-show-spelling').onclick = _ => {
    actionMgr.toggleShowSpelling();
  };
  shadowRoot.querySelector('#toggle-clef').onclick = _ => {
    actionMgr.toggleClef();
  };
  shadowRoot.querySelector('#toggle-24-44').onclick = _ => {
    actionMgr.toggle24And44();
  };
  shadowRoot.querySelector('#incr-beat-size').onclick = _ => {
    actionMgr.incrStep();
  };
  shadowRoot.querySelector('#decr-beat-size').onclick = _ => {
    actionMgr.decrStep();
  };
  shadowRoot.querySelector('#incr-keyboard').onclick = _ => {
    actionMgr.incrNoteNumShift();
  };
  shadowRoot.querySelector('#decr-keyboard').onclick = _ => {
    actionMgr.decrNoteNumShift();
  };
  shadowRoot.querySelector('#export-abc').onclick = _ => {
    actionMgr.exportAbc();
  };
  shadowRoot.querySelector('#insert-grace-note').onclick = _ => {
    actionMgr.insertGraceNote();
  };
  shadowRoot.querySelector('#update-lyrics').onclick = _ => {
    actionMgr.updateLyrics();
  };

  shadowRoot.querySelector('#set-key-sig').onclick = _ => {
    actionMgr.setKeySig();
  };
  shadowRoot.querySelector('#transpose-key').onclick = _ => {
    actionMgr.transpose();
  };
  shadowRoot.querySelector('#enharmSpelling').onclick = _ => {
    actionMgr.enharmSpelling();
  };

  shadowRoot.querySelector('#incr-pickup').onclick = _ => {
    actionMgr.incrPickup();
  };
  shadowRoot.querySelector('#decr-pickup').onclick = _ => {
    actionMgr.decrPickup();
  };
  shadowRoot.querySelector('#incr-time-sig').onclick = _ => {
    actionMgr.incrTimeSigNumer();
  };
  shadowRoot.querySelector('#decr-time-sig').onclick = _ => {
    actionMgr.decrTimeSigNumer();
  };
  shadowRoot.querySelector('#incr-time-sig-denom').onclick = _ => {
    actionMgr.incrTimeSigDenom();
  };
  shadowRoot.querySelector('#decr-time-sig-denom').onclick = _ => {
    actionMgr.decrTimeSigDenom();
  };
  shadowRoot.querySelector('#set-tempo').onclick = _ => {
    actionMgr.setTempo();
  };
  shadowRoot.querySelector('#swingify').onclick = _ => {
    actionMgr.swingify();
  };
  shadowRoot.querySelector('#implicitSwing').onclick = _ => {
    actionMgr.implicitSwing();
  };

  shadowRoot.querySelector('#bass-1').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addSimpleBass();
  }
  shadowRoot.querySelector('#bass-2').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addTwoBeatBass();
  }
  shadowRoot.querySelector('#bossa').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addBossaNovaComping();
    stateMgr.appendVoice();
    actionMgr.addBossaNovaBass();
  }
  shadowRoot.querySelector('#comping-1').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addSimpleComping();
  }
  shadowRoot.querySelector('#comping-2').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addOneBeatComping();
  }
  shadowRoot.querySelector('#comping-3').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addFingerStyleComping();
  }
  shadowRoot.querySelector('#comping-4').onclick = _ => {
    stateMgr.appendVoice();
    actionMgr.addMelodicComping();
  }
}