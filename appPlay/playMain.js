
import { parseSheetToSong } from "../esModules/sheet-to-song/parse.js";
import { RenderMgr } from "../esModules/sheet-to-song/render.js";
import { SongReplayer } from "../esModules/song-replay/songReplay.js";
import * as banner from '../esModules/ephemeral-banner/index.js';
import * as sound from '../esModules/musical-sound/musicalSound.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';

setup()

function setup() {
  const song = loadSongFromUrl();
  const canvasDiv = document.getElementById("canvas-div");
  const renderMgr = new RenderMgr(canvasDiv);
  renderMgr.render(song);

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

  setupInteraction(songReplayer, song);
}

function setupInteraction(songReplayer, song) {
  document.getElementById("play-btn").onclick = _ => {
    if (songReplayer.isPlaying()) {
      songReplayer.stop();
    } else {
      songReplayer.play(song, {addDrumBeat: true})
    }
  };
  
}
function loadSongFromUrl() {
  const url = new URL(document.URL);
  const title = url.searchParams.get('title') || 'Untitled';
  const dataStr = url.searchParams.get('data');
  if (!dataStr) {
    return;
  }
  // const title = 'testing';
  // const dataStr = `[["","Key: C","","",""],["","Part: V1","","",""],["","Tempo: 180","","",""],["","Swing: light","","",""],["_ Gsus","Cmaj7","Bm7b5 | E7#11","Am9","Gm7 | C7b13"],["","","","",""],["","F6add9","Fm7 | Bb7b13","Ebm7 | Ab7b13","Dm7 | G7b13"],["","","","",""],["","Part: V2","","",""],["","Repeat: V1","","",""],["","-","-","-","-"],["","","","",""],["","-","Fm7 | Bb7","Ebm7 | Ab7",""],["","","","",""],["","Part: Outro","","",""],["","Dm7 | Em7","Fmaj7","Dm7 | Em7","Fmaj7"],["","","","",""],["","Dm7 | Em7","Fmaj7","_ Dm7 | Em7 Fmaj7 | F7 G7 | Db7 _","C6"]]`
  const data = JSON.parse(dataStr);
  console.log(data);
  return parseSheetToSong(data, title);
}

