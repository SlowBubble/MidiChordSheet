
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
    metronomeBeatSub: metronomeBeatSub,
  });
  actionMgr.reloadSong();

  setupInteraction(actionMgr);

  actionMgr.toggleMenu();
}

function setupInteraction(actionMgr) {
  document.getElementById("play-btn").onclick = _ => actionMgr.playOrPause();
  hotkeysDoc('space', _ => actionMgr.playOrPause());

  document.getElementById("menu-btn").onclick = _ => actionMgr.toggleMenu();
  hotkeysDoc('m', _ => actionMgr.toggleMenu());

  hotkeysDoc('s', _ => actionMgr.toggleSwing());
  document.getElementById("incr-swing-btn").onclick = _ => actionMgr.toggleSwing();
  document.getElementById("decr-swing-btn").onclick = _ => actionMgr.toggleSwing();

  hotkeysDoc('t', _ => actionMgr.increaseTempo());
  hotkeysDoc('shift+t', _ => actionMgr.decreaseTempo());
  document.getElementById("incr-tempo-btn").onclick = _ => actionMgr.increaseTempo();
  document.getElementById("decr-tempo-btn").onclick = _ => actionMgr.decreaseTempo();

  hotkeysDoc('r', _ => actionMgr.incrementRepeat());
  hotkeysDoc('shift+r', _ => actionMgr.decrementRepeat());
  document.getElementById("incr-repeats-btn").onclick = _ => actionMgr.incrementRepeat();
  document.getElementById("decr-repeats-btn").onclick = _ => actionMgr.decrementRepeat();

  hotkeysDoc(`u`, _ => actionMgr.incrTimeSigUpperNumeral());
  hotkeysDoc('shift+u', _ => actionMgr.decrTimeSigUpperNumeral());
  document.getElementById("incr-upper-numeral-btn").onclick = _ => actionMgr.incrTimeSigUpperNumeral();
  document.getElementById("decr-upper-numeral-btn").onclick = _ => actionMgr.decrTimeSigUpperNumeral();

  hotkeysDoc('k', _ => actionMgr.transposeKeyUp());
  hotkeysDoc('shift+k', _ => actionMgr.transposeKeyDown());
  document.getElementById("transpose-up-btn").onclick = _ => actionMgr.transposeKeyUp();
  document.getElementById("transpose-down-btn").onclick = _ => actionMgr.transposeKeyDown();

  hotkeysDoc('o', _ => actionMgr.increaseOffbeatSyncopation());
  hotkeysDoc('shift+o', _ => actionMgr.decreaseDensity());
  document.getElementById("incr-syncopation-btn").onclick = _ => actionMgr.increaseOffbeatSyncopation();
  document.getElementById("decr-syncopation-btn").onclick = _ => actionMgr.decreaseOffbeatSyncopation();

  hotkeysDoc('d', _ => actionMgr.increaseDensity());
  hotkeysDoc('shift+d', _ => actionMgr.decreaseDensity());

  hotkeysDoc('b', _ => actionMgr.incrementBeatSubdivision());
  hotkeysDoc('shift+b', _ => actionMgr.decreaseOffbeatSyncopation());
  document.getElementById("incr-subdivision-btn").onclick = _ => actionMgr.incrementBeatSubdivision();
  document.getElementById("decr-subdivision-btn").onclick = _ => actionMgr.decrementBeatSubdivision();

  hotkeysDoc('c', _ => actionMgr.toggleChordView());
  hotkeysDoc('0', _ => actionMgr.stop());
  hotkeysDoc('up', _ => actionMgr.moveUp());
  hotkeysDoc('down', _ => actionMgr.moveDown());
}
