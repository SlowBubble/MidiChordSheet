import { parseKeyValsToSongInfo, HeaderType } from "../esModules/sheet-to-song/parse.js";
import { fromNoteNumWithFlat } from "../esModules/chord/spell.js";
import { joinSongParts } from "../esModules/sheet-to-song/songForm.js";
import { ChordSvgMgr } from "../esModules/chord-svg/chordSvg.js";
import { makeFrac } from "../esModules/fraction/fraction.js";

export class ActionMgr {
  constructor({
    songReplayer,
    eBanner,
    renderMgr,
    menuDiv,
    metronomeBeatSub,
  }) {
    this.songReplayer = songReplayer;
    this.eBanner = eBanner;
    this.renderMgr = renderMgr;
    this.menuDiv = menuDiv;
    this.song = null;
    this.initialHeaders = {};
    this.chordSvgMgr = new ChordSvgMgr();
    this.displayChordsOnly = true;
    this.chordsCanvas = document.getElementById('chords-canvas');
    // null means play from the start.
    this.currTime8n = null;
    metronomeBeatSub(beat => {
      this.setCurrTime8n(beat.time8n);
      if (this.displayChordsOnly) {
        this.renderChordsCanvas();
      }
    });
  }

  // Note that this may be more wasteful than needed.
  render() {
    if (this.displayChordsOnly) {
      this.renderMgr.clear();
      this.renderChordsCanvas();
    } else {
      this.renderMgr.render(this.song);
      this.clearChordsCanvas();
    }
  }
  toggleChordView() {
    this.displayChordsOnly = !this.displayChordsOnly;
    this.render();
  }

  renderChordsCanvas() {
    this.chordsCanvas.innerHTML = '';
    // this.chordsCanvas.append(...this.chordSvgMgr.getSvgs());
    this.chordsCanvas.append(this.chordSvgMgr.getSvg());
  }
  clearChordsCanvas() {
    this.chordsCanvas.innerHTML = '';
  }

  reloadSong() {
    const urlKeyVals = getUrlKeyVals();
    const songInfo = parseKeyValsToSongInfo(urlKeyVals);
    this.song = joinSongParts(songInfo.songParts, songInfo.title);
    this.initialHeaders = songInfo.initialHeaders;

    const subdivisions = this.initialHeaders[HeaderType.Subdivision];
    let swing = urlKeyVals[HeaderType.Swing] || 'Straight';
    if (subdivisions > 2 && swing !== 'Straight') {
      swing += '*';
    }
    document.getElementById('subdivision-display').textContent = subdivisions;
    document.getElementById('tempo-display').textContent = this.initialHeaders[HeaderType.Tempo];
    document.getElementById('swing-display').textContent = swing;
    document.getElementById('key-display').textContent = fromNoteNumWithFlat(
      this.initialHeaders[HeaderType.Key].toNoteNum() + this.initialHeaders[HeaderType.Transpose]);
    document.getElementById('repeat-display').textContent = this.initialHeaders[HeaderType.Repeat];
    document.getElementById('upper-numeral-display').textContent = this.initialHeaders[HeaderType.Meter].upperNumeral;

    this.chordSvgMgr = new ChordSvgMgr(songInfo.songParts, this.currTime8n);
    this.render();
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
      this.play();
    }
  }

  play() {
    if (this.songReplayer.isPlaying()) {
      return;
    }
    this.songReplayer.play(this.getSong(), {
      start8n: this.currTime8n && this.currTime8n.leq(this.song.getFinalChordTime8n()) ? this.currTime8n : undefined,
      addDrumBeat: true, padLeft: true, muteFinalMeasure: true,
      numBeatDivisions: this.initialHeaders[HeaderType.Subdivision],
    });
  }

  setCurrTime8n(time8n) {
    this.currTime8n = time8n;
    this.chordSvgMgr.setCurrTime8n(this.currTime8n);
  }

  moveToStart() {
    this.actAndResume(_ => {
      this.setCurrTime8n(null)
      this.render();
    });
  }

  moveLeft() {
    this.move(-1);
  }
  moveRight() {
    this.move(1);
  }
  moveDown() {
    this.move(4);
  }
  moveUp() {
    this.move(-4);
  }

  actAndResume(action) {
    const shouldStopAndResume = this.songReplayer.isPlaying();
    if (shouldStopAndResume) {
      this.songReplayer.stop();
    }
    action();
    if (shouldStopAndResume) {
      this.play();
    }
  }

  move(numBars) {
    this.actAndResume(_ => {
      numBars = numBars || 1;
      const durPerMeasure8n = this.song.timeSigChanges.defaultVal.getDurPerMeasure8n();
      const currTime = this.currTime8n || makeFrac(0);
      const unroundedBarNum = currTime.over(durPerMeasure8n).toFloat();
      let barNum = numBars > 0 ? Math.ceil(unroundedBarNum) : Math.floor(unroundedBarNum);
      barNum += numBars;
  
      let newTime8n = null;
      if (barNum > 0) {
        newTime8n = durPerMeasure8n.times(barNum);
        if (newTime8n.geq(this.song.getEnd8n())) {
          newTime8n = this.song.getEnd8n();
        }
      }
      this.setCurrTime8n(newTime8n);
      this.render();
    });
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
      setUrlParam(HeaderType.Swing, 'Medium');
    }
    this.reloadSong();
  }

  decreaseTempo() {
    const tempo = this.initialHeaders[HeaderType.Tempo];
    if (tempo - 10 <= 0) {
      return;
    }
    setUrlParam(HeaderType.Tempo, tempo - 10);
    this.reloadSong();
  }
  increaseTempo() {
    const tempo = this.initialHeaders[HeaderType.Tempo];
    setUrlParam(HeaderType.Tempo, tempo + 10);
    this.reloadSong();
  }

  transposeKeyDown() {
    const transpose = this.initialHeaders[HeaderType.Transpose];
    setUrlParam(HeaderType.Transpose, (transpose - 1) % 12);
    this.reloadSong();
  }
  transposeKeyUp() {
    const transpose = this.initialHeaders[HeaderType.Transpose];
    setUrlParam(HeaderType.Transpose, (transpose + 1) % 12);
    this.reloadSong();
  }

  decreaseOffbeatSyncopation() {
    const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
    setUrlParam(HeaderType.Syncopation, syncopationPct - 3);
    this.reloadSong();
  }
  increaseOffbeatSyncopation() {
    const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
    setUrlParam(HeaderType.Syncopation, syncopationPct + 3);
    this.reloadSong();
  }

  decreaseDensity() {
    const densityPct = this.initialHeaders[HeaderType.Density];
    setUrlParam(HeaderType.Density, densityPct - 3);
    this.reloadSong();
  }
  increaseDensity() {
    const densityPct = this.initialHeaders[HeaderType.Density];
    setUrlParam(HeaderType.Density, densityPct + 3);
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

  incrementRepeat() {
    let repeat = this.initialHeaders[HeaderType.Repeat];
    repeat += 1;
    setUrlParam(HeaderType.Repeat, repeat);
    this.reloadSong();
  }
  decrementRepeat() {
    let repeat = this.initialHeaders[HeaderType.Repeat];
    if (repeat <= 0) {
      return;
    }
    repeat -= 1;
    setUrlParam(HeaderType.Repeat, repeat);
    this.reloadSong();
  }

  incrementBeatSubdivision() {
    let subdivision = this.initialHeaders[HeaderType.Subdivision];
    subdivision += 1;
    setUrlParam(HeaderType.Subdivision, subdivision);
    this.reloadSong();
  }
  decrementBeatSubdivision() {
    let subdivision = this.initialHeaders[HeaderType.Subdivision];
    if (subdivision <= 1) {
      return;
    }
    subdivision -= 1;
    setUrlParam(HeaderType.Subdivision, subdivision);
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
  // This causes data= to come last because the rest of the param keys are upper cases, which has a smaller unicode code point.
  internalUrl.searchParams.sort();
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
    // keyVals.title = 'Etude No. 3';
    // keyVals.data = `[["","Key: C","","",""],["","Part: V1","","",""],["","Tempo: 180","","",""],["","Swing: light","","",""],["_ Gsus","Cmaj7","Bm7b5 | E7#11","Am9","Gm7 | C7b13"],["","","","",""],["","F6add9","Fm7 | Bb7b13","Ebm7 | Ab7b13","Dm7 | G7b13"],["","","","",""],["","Part: V2","","",""],["","Repeat: V1","","",""],["","-","-","-","-"],["","","","",""],["","-","Fm7 | Bb7","Ebm7 | Ab7",""],["","","","",""],["","Part: Outro","","",""],["","Dm7 | Em7","Fmaj7","Dm7 | Em7","Fmaj7"],["","","","",""],["","Dm7 | Em7","Fmaj7","_ Dm7 | Em7 Fmaj7 | F7 G7 | Db7 _","C6"]]`
  }
  return keyVals;

}