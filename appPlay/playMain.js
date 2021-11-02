
import { RenderMgr } from "../esModules/sheet-to-song/render.js";
import { SongReplayer } from "../esModules/song-replay/songReplay.js";
import * as banner from '../esModules/ephemeral-banner/index.js';
import * as sound from '../esModules/musical-sound/musicalSound.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';
import { ActionMgr } from "./actionMgr.js";
import { hotkeysDoc } from "../esModules/hotkeys-doc/hotkeysDoc.js";
import { LyricsDisplayer } from "../esModules/lyrics-display/lyricsDisplayer.js";
import { setupKeyboard } from "../esModules/keyboard-to-midi-evt/index.js";


setup()

async function setup() {
  const canvasDiv = document.getElementById("canvas-div");
  const renderMgr = new RenderMgr(canvasDiv);

  const [soundPub, soundSub] = pubSub.make();
  const [metronomeBeatPub, metronomeBeatSub] = pubSub.make();
  const [readyPub, readySub] = pubSub.make();
  const [playEndedPub, playEndedSub] = pubSub.make();
  const [currTimePub, currTimeSub] = pubSub.make();

  const eBanner = banner.setup();
  const musicalSound = new sound.MusicalSound({
    midiJs: window.MIDI, soundSub: soundSub, 
    eBanner: eBanner, readyPub: readyPub
  });
  setupKeyboard(soundPub);
  const lyricsDisplayer = new LyricsDisplayer({
    currTimeSub: currTimeSub,
    eBanner: eBanner,
  });
  const songReplayer = new SongReplayer({
    musicalSound: musicalSound, 
    metronomeBeatPub: metronomeBeatPub,
    playEndedPub: playEndedPub,
    currTimePub: currTimePub,
  });
  const actionMgr = new ActionMgr({
    songReplayer: songReplayer,
    eBanner: eBanner,
    renderMgr: renderMgr,
    menuDiv: document.getElementById("menu"),
    metronomeBeatSub: metronomeBeatSub,
    playEndedSub: playEndedSub,
    lyricsDisplayer: lyricsDisplayer,
  });
  await actionMgr.reloadSong();
  setupInteraction(actionMgr);
  actionMgr.toggleMenu();
}

function setupInteraction(actionMgr) {
  document.getElementById("play-btn").onclick = _ => actionMgr.playOrPause();
  hotkeysDoc('space', _ => actionMgr.playOrPause());

  document.getElementById("menu-btn").onclick = _ => actionMgr.toggleMenu();
  hotkeysDoc('shift+m', _ => actionMgr.toggleMenu());

  hotkeysDoc('shift+s', _ => actionMgr.toggleSwing());
  document.getElementById("incr-swing-btn").onclick = _ => actionMgr.toggleSwing();
  document.getElementById("decr-swing-btn").onclick = _ => actionMgr.toggleSwing();

  hotkeysDoc('shift+t', _ => actionMgr.increaseTempo());
  hotkeysDoc('alt+shift+t', _ => actionMgr.decreaseTempo());
  document.getElementById("incr-tempo-btn").onclick = _ => actionMgr.increaseTempo();
  document.getElementById("decr-tempo-btn").onclick = _ => actionMgr.decreaseTempo();

  hotkeysDoc('shift+r', _ => actionMgr.incrementRepeat());
  hotkeysDoc('alt+shift+r', _ => actionMgr.decrementRepeat());
  document.getElementById("incr-repeats-btn").onclick = _ => actionMgr.incrementRepeat();
  document.getElementById("decr-repeats-btn").onclick = _ => actionMgr.decrementRepeat();

  hotkeysDoc(`shift+u`, _ => actionMgr.incrTimeSigUpperNumeral());
  hotkeysDoc('alt+shift+u', _ => actionMgr.decrTimeSigUpperNumeral());
  document.getElementById("incr-upper-numeral-btn").onclick = _ => actionMgr.incrTimeSigUpperNumeral();
  document.getElementById("decr-upper-numeral-btn").onclick = _ => actionMgr.decrTimeSigUpperNumeral();

  hotkeysDoc('shift+k', _ => actionMgr.transposeKeyUp());
  hotkeysDoc('alt+shift+k', _ => actionMgr.transposeKeyDown());
  document.getElementById("transpose-up-btn").onclick = _ => actionMgr.transposeKeyUp();
  document.getElementById("transpose-down-btn").onclick = _ => actionMgr.transposeKeyDown();

  hotkeysDoc('shift+o', _ => actionMgr.increaseOffbeatSyncopation());
  hotkeysDoc('alt+shift+o', _ => actionMgr.decreaseDensity());
  document.getElementById("incr-syncopation-btn").onclick = _ => actionMgr.increaseOffbeatSyncopation();
  document.getElementById("decr-syncopation-btn").onclick = _ => actionMgr.decreaseOffbeatSyncopation();

  hotkeysDoc('shift+d', _ => actionMgr.increaseDensity());
  hotkeysDoc('alt+shift+d', _ => actionMgr.decreaseDensity());

  hotkeysDoc('shift+n', _ => actionMgr.startNextSong());

  hotkeysDoc('shift+b', _ => actionMgr.incrementBeatSubdivision());
  hotkeysDoc('alt+shift+b', _ => actionMgr.decreaseOffbeatSyncopation());
  document.getElementById("incr-subdivision-btn").onclick = _ => actionMgr.incrementBeatSubdivision();
  document.getElementById("decr-subdivision-btn").onclick = _ => actionMgr.decrementBeatSubdivision();

  hotkeysDoc('shift+l', _ => actionMgr.toggleLyrics());
  hotkeysDoc('alt+shift+l', _ => actionMgr.toggleSolfegeLyrics());
  hotkeysDoc('shift+c', _ => actionMgr.toggleChordView());
  hotkeysDoc('shift+i', _ => actionMgr.toggleImprovTactics());
  hotkeysDoc('backspace', _ => actionMgr.moveToStart());
  hotkeysDoc('up', _ => actionMgr.moveUp());
  hotkeysDoc('down', _ => actionMgr.moveDown());
  hotkeysDoc('left', _ => actionMgr.moveLeft());
  hotkeysDoc('right', _ => actionMgr.moveRight());
}
