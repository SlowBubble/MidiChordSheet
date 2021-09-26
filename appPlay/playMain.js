
import { RenderMgr } from "../esModules/sheet-to-song/render.js";
import { SongReplayer } from "../esModules/song-replay/songReplay.js";
import * as banner from '../esModules/ephemeral-banner/index.js';
import * as sound from '../esModules/musical-sound/musicalSound.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import { ActionMgr } from "./actionMgr.js";
import { hotkeysDoc } from "../esModules/hotkeys-doc/hotkeysDoc.js";


setup()

function setup() {
  const canvasDiv = document.getElementById("canvas-div");
  const renderMgr = new RenderMgr(canvasDiv);
  // const urlData = getUrlData();
  // const song = parseSheetToSong(urlData.jsonPayload, urlData.keyVals.title);
  // renderMgr.render(song);

  const [soundPub, soundSub] = pubSub.make();
  const [metronomeBeatPub, metronomeBeatSub] = pubSub.make();
  const [readyPub, readySub] = pubSub.make();

  const eBanner = banner.setup();
  const musicalSound = new sound.MusicalSound({
    midiJs: window.MIDI, soundSub: soundSub, 
    eBanner: eBanner, readyPub: readyPub
  });
  const songReplayer = new SongReplayer({
    musicalSound: musicalSound, 
    metronomeBeatPub: metronomeBeatPub,
  });
  const actionMgr = new ActionMgr({
    songReplayer: songReplayer,
    eBanner: eBanner,
    renderMgr: renderMgr,
    menuDiv: document.getElementById("menu"),
  });
  actionMgr.reloadSong();

  setupInteraction(actionMgr);
}

function setupInteraction(actionMgr) {
  document.getElementById("play-btn").onclick = _ => actionMgr.playOrPause();
  hotkeysDoc('space', _ => actionMgr.playOrPause());

  document.getElementById("menu-btn").onclick = _ => actionMgr.toggleMenu();
  hotkeysDoc('m', _ => actionMgr.toggleMenu());

  hotkeysDoc('s', _ => actionMgr.toggleSwing());

  hotkeysDoc(',', _ => actionMgr.decrTempo());
  hotkeysDoc('.', _ => actionMgr.incrTempo());

  hotkeysDoc('r', _ => actionMgr.incrRepeat());
  hotkeysDoc('shift+r', _ => actionMgr.decrRepeat());

  hotkeysDoc(';', _ => actionMgr.decrTimeSigUpperNumeral());
  hotkeysDoc(`'`, _ => actionMgr.incrTimeSigUpperNumeral());

  hotkeysDoc('-', _ => actionMgr.transposeDown());
  hotkeysDoc('=', _ => actionMgr.transposeUp());
  
}
