
import * as action from './action.js';
import * as banner from './banner.js';
import * as beat from './beat.js';
import * as event from './event.js';
import * as midiInput from './midiInput.js';
import * as musicKeyboard from './musicKeyboard.js';
import * as menu from './menu.js';
import * as musicMainHtml from './musicMainHtml.js';
import * as shortcuts from './shortcuts.js';
import * as signIn from './signIn.js';
import * as sound from './sound.js';
import * as state from './state.js';
import * as mobile from './mobile.js';
import * as melodicSnapshot from './melodicSnapshot.js';
import * as trumpet from './trumpet.js';


export class MusicCanvas extends HTMLElement {
  connectedCallback() {
    // For debugging purposes
    window.musicCanvas = this;

    // 0. Setup html
    // Disabling shadow root because certain elements are inaccessible to abcjs.
    // const shadowRoot = this.attachShadow({ mode: 'open' });
    const shadowRoot = this;
    shadowRoot.innerHTML = musicMainHtml.shadowRootHtml;

    const eBanner = new banner.EphemeralBanner();
    document.body.appendChild(eBanner);

    // const [loadedPub, loadedSub] = event.pubsub();
    const [keyupPub, keyupSub] = event.pubsub();
    const [keydownPub, keydownSub] = event.pubsub();
    const [possBeatPub, possBeatSub] = event.pubsub();
    const [beatPub, beatSub] = event.pubsub();
    const [notedownPub, notedownSub] = event.pubsub();
    const [noteupPub, noteupSub] = event.pubsub();
    const [beatModePub, beatModeSub] = event.pubsub();
    const [aggrStoppedPub, aggrStoppedSub] = event.pubsub();
    const [aggrPub, aggrSub] = event.pubsub();
    const [appendPub, appendSub] = event.pubsub();
    const [roundedNotesPub, roundedNotesSub] = event.pubsub();
    const [renderPub, renderSub] = event.pubsub();
    const [execPub, execSub] = event.pubsub();
    const [disablePub, disableSub] = event.pubsub();
    const [valveDownPub, valveDownSub] = event.pubsub();
    const [valveUpPub, valveUpSub] = event.pubsub();
    const url = new URL(document.URL);
    let urlId = url.searchParams.get('id');
    if (!urlId) {
      urlId = (new Date).toISOString().replace(/:/g,'_');
      const newUrl = new URL(document.URL);
      newUrl.searchParams.set('id', urlId);
      window.location.href = newUrl.href;
    }

    // TODO:Replace this section via event-driven components
    const stateMgr = new state.StateMgr(eBanner, urlId, shadowRoot, execPub);
    // For debugging purposes
    this.stateMgr = stateMgr;

    function renderFunc() {
      // clock.start('getAbc');
      const abc = stateMgr.getAbc();
      // clock.stop('getAbc');
      const params = {
        // scale: 1,
        // add_classes: true,
        // clickListener: function(abcElem, tuneNumber, classes) {
        //   console.log('abcElem', abcElem);
        //   console.log('classes', classes);
        // },
      };
      const moreParams = mobile.isMobile() ? { responsive: 'resize' } : {};
      const canvasDiv = shadowRoot.querySelector("#canvas-div")
      ABCJS.renderAbc(canvasDiv, abc, params, moreParams);
      // TODO impl a custom MIDI solution.
      if (stateMgr.viewMode) {
        ABCJS.renderMidi(
          shadowRoot.querySelector("#midi-div"),
          abc,
          {chordsOff: true,});
      }
    }

    renderSub(_ => {
      renderFunc();
    });
    midiInput.setup(notedownPub, noteupPub, possBeatPub);
    const actionMgr = new action.ActionMgr(
      eBanner, stateMgr, renderPub, execPub, execSub, shadowRoot);
    beatModeSub(bm => {
      if (!bm) {
        window.setTimeout(() => {
          renderFunc();      
        }, 20);
      }
    });

    const noteGpsMgr = new melodicSnapshot.NoteGpsMgr(
      beatModeSub, stateMgr, aggrStoppedSub);

    trumpet.setup(valveDownSub, valveUpSub, notedownPub, noteupPub);
    new musicKeyboard.DebounceFilter(stateMgr, keydownPub, keyupPub);
    new musicKeyboard.NoteDownFilter(
      keydownSub, notedownPub, stateMgr, keyupSub, noteupPub, noteGpsMgr,
      valveDownPub, valveUpPub, midiInput.hasMidiInputs);
    new musicKeyboard.PossBeatFilter(keydownSub, possBeatPub, disablePub, midiInput.hasMidiInputs);
    new musicKeyboard.BeatFilter(disablePub, disableSub, possBeatSub, beatPub, beatModePub, eBanner, null, execPub);

    new beat.Aggregator(
      beatSub, notedownSub, noteupSub, beatModeSub, aggrPub, appendPub, aggrStoppedPub, stateMgr);
    new beat.Rounder(aggrSub, roundedNotesPub);
    const resourceContentionDelayMillis = 100;
    new beat.Upserter(
      roundedNotesSub, appendSub, stateMgr, actionMgr, resourceContentionDelayMillis);

    shortcuts.setup(actionMgr, stateMgr, eBanner, disablePub, midiInput.hasMidiInputs);
    menu.setup(shadowRoot, actionMgr, stateMgr);

    signIn.setupSignInButton(shadowRoot, eBanner);
    signIn.setupHomeLink(shadowRoot);

    if (!stateMgr.viewMode) {
      // Needed to not break abcjs's midi when in view mode.
      sound.insertScriptsDynamically(shadowRoot);
      const pedalDelayMillis = 200;
      window.onload = _ => {
        sound.setup(eBanner, notedownSub, noteupSub, pedalDelayMillis);
      }
    }
  }
}

customElements.define('music-canvas', MusicCanvas);
