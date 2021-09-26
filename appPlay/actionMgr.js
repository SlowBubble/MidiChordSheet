import { parseKeyValsToSongInfo, HeaderType } from "../esModules/sheet-to-song/parse.js";

export class ActionMgr {
  constructor({
    songReplayer,
    eBanner,
    renderMgr,
    menuDiv,
  }) {
    this.songReplayer = songReplayer;
    this.eBanner = eBanner;
    this.renderMgr = renderMgr;
    this.menuDiv = menuDiv;
    this.song = null;
    this.initialHeaders = {};
  }

  reloadSong() {
    const urlKeyVals = getUrlKeyVals();
    const songInfo = parseKeyValsToSongInfo(urlKeyVals);
    this.renderMgr.render(songInfo.song);
    this.song = songInfo.song;
    this.initialHeaders = songInfo.initialHeaders;
    console.log(songInfo.initialHeaders)
  }

  getSong() {
    if (!this.song) {
      this.reloadSong();
    }
    return this.song;
  }

  playOrPause() {
    if (this.songReplayer.isPlaying()) {
      this.songReplayer.stop();
    } else {
      this.songReplayer.play(this.getSong(), {addDrumBeat: true})
    }
  }

  toggleMenu() {
    if (this.menuDiv.style.display === 'none') {
      this.menuDiv.style.display = '';
    } else {
      this.menuDiv.style.display = 'none';
    }
  }

  toggleSwing() {
    const swing = this.initialHeaders[HeaderType.Swing];
    if (swing.ratio.greaterThan(1)) {
      setUrlParam(HeaderType.Swing);
    } else {
      setUrlParam(HeaderType.Swing, 'medium');
    }
    this.reloadSong();
  }

  decrTempo() {
    const tempo = this.initialHeaders[HeaderType.Tempo];
    if (tempo - 10 <= 0) {
      return;
    }
    setUrlParam(HeaderType.Tempo, tempo - 10);
    this.reloadSong();
  }
  incrTempo() {
    const tempo = this.initialHeaders[HeaderType.Tempo];
    setUrlParam(HeaderType.Tempo, tempo + 10);
    this.reloadSong();
  }

  transposeDown() {
    const transpose = this.initialHeaders[HeaderType.Transpose];
    setUrlParam(HeaderType.Transpose, (transpose - 1) % 12);
    this.reloadSong();
  }
  transposeUp() {
    const transpose = this.initialHeaders[HeaderType.Transpose];
    setUrlParam(HeaderType.Transpose, (transpose + 1) % 12);
    this.reloadSong();
  }

  decrSyncopation() {
    const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
    setUrlParam(HeaderType.Syncopation, syncopationPct - 5);
    this.reloadSong();
  }
  incrSyncopation() {
    const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
    setUrlParam(HeaderType.Syncopation, syncopationPct + 5);
    this.reloadSong();
  }

  decrTimeSigUpperNumeral() {
    const timeSig = this.initialHeaders[HeaderType.Meter];
    if (timeSig.upperNumeral <= 2) {
      return;
    }
    timeSig.upperNumeral -= 1;
    setUrlParam(HeaderType.Meter, timeSig.toString());
    this.reloadSong();
  }

  incrTimeSigUpperNumeral() {
    const timeSig = this.initialHeaders[HeaderType.Meter];
    timeSig.upperNumeral += 1;
    setUrlParam(HeaderType.Meter, timeSig.toString());
    this.reloadSong();
  }
}

function setUrlParam(key, val) {
  const url = toInternalUrl(document.URL);
  if (val) {
    url.searchParams.set(key, val);
  } else {
    url.searchParams.delete(key);
  }
  const externalUrlStr = toExternalUrlStr(url);
  window.location.hash = externalUrlStr.includes('#') ? externalUrlStr.split('#')[1] : '';
}

function toInternalUrl(externalUrlStr) {
  return new URL(externalUrlStr.replace('#','?'));
}

function toExternalUrlStr(internalUrl) {
  return internalUrl.href.replace('?','#');
}

function getUrlKeyVals() {
  const url = toInternalUrl(document.URL);
  const keyVals = {};
  url.searchParams.forEach(function(value, key) {
    keyVals[key] = value;
  });
  if (!keyVals.data) {
    keyVals.title = 'Uncle Sun';
    keyVals.data = '[["","Tempo: 180","","",""],["","Key: C","","",""],["","Cmaj7","C6","Em","Em A7"],["","","","",""],["","Em7b5","Fmaj7","Bb7","C6"]]';
    keyVals.title = 'Etude No. 3';
    keyVals.data = `[["","Key: C","","",""],["","Part: V1","","",""],["","Tempo: 180","","",""],["","Swing: light","","",""],["_ Gsus","Cmaj7","Bm7b5 | E7#11","Am9","Gm7 | C7b13"],["","","","",""],["","F6add9","Fm7 | Bb7b13","Ebm7 | Ab7b13","Dm7 | G7b13"],["","","","",""],["","Part: V2","","",""],["","Repeat: V1","","",""],["","-","-","-","-"],["","","","",""],["","-","Fm7 | Bb7","Ebm7 | Ab7",""],["","","","",""],["","Part: Outro","","",""],["","Dm7 | Em7","Fmaj7","Dm7 | Em7","Fmaj7"],["","","","",""],["","Dm7 | Em7","Fmaj7","_ Dm7 | Em7 Fmaj7 | F7 G7 | Db7 _","C6"]]`
  }
  return keyVals;

}