import { HeaderType } from "../esModules/sheet-to-song/parse.js";
import { fromNoteNumWithFlat } from "../esModules/chord/spell.js";
import { joinSongParts } from "../esModules/sheet-to-song/songForm.js";
import { ChordSvgMgr } from "../esModules/chord-svg/chordSvg.js";
import { makeFrac } from "../esModules/fraction/fraction.js";
import { parseKeyValsToSongInfo2 } from "../esModules/sheet-to-song/parseV2.js";

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
    this.chordSvgMgr = new ChordSvgMgr({});
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
    console.log(this.song);
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
    const svgInfo = this.chordSvgMgr.getSvgInfo();
    this.chordsCanvas.append(svgInfo.svg);
    svgInfo.currentSvg.scrollIntoView({behavior: "smooth", block: "center"});
  }
  clearChordsCanvas() {
    this.chordsCanvas.innerHTML = '';
  }

  reloadSong() {
    const urlKeyVals = getUrlKeyVals();
    // const songInfo = parseKeyValsToSongInfo(urlKeyVals);
    const songInfo = parseKeyValsToSongInfo2(urlKeyVals);
    this.song = joinSongParts(songInfo.songPartsWithVoice, songInfo.songForm.title);
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
    
    this.chordSvgMgr = new ChordSvgMgr({
      songForm: songInfo.songForm,
      songParts: songInfo.songPartsWithVoice,
      currTime8n: this.currTime8n || {}
    });
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
      addDrumBeat: true, padLeft: true,
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
    this.reloadSong();
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
    this.actAndResume(_ => {
      const swing = this.initialHeaders[HeaderType.Swing];
      if (swing.ratio.greaterThan(1)) {
        setUrlParam(HeaderType.Swing);
      } else {
        setUrlParam(HeaderType.Swing, 'Medium');
      }
    });
  }

  decreaseTempo() {
    this.actAndResume(_ => {
      const tempo = this.initialHeaders[HeaderType.Tempo];
      if (tempo - 10 <= 0) {
        return;
      }
      setUrlParam(HeaderType.Tempo, tempo - 10);
    });
  }
  increaseTempo() {
    this.actAndResume(_ => {
      const tempo = this.initialHeaders[HeaderType.Tempo];
      setUrlParam(HeaderType.Tempo, tempo + 10);
    });
  }

  transposeKeyDown() {
    this.actAndResume(_ => {
      const transpose = this.initialHeaders[HeaderType.Transpose];
      setUrlParam(HeaderType.Transpose, (transpose - 1) % 12);
    });
  }
  transposeKeyUp() {
    this.actAndResume(_ => {
      const transpose = this.initialHeaders[HeaderType.Transpose];
      setUrlParam(HeaderType.Transpose, (transpose + 1) % 12);
    });
}

  decreaseOffbeatSyncopation() {
    this.actAndResume(_ => {
      const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
      setUrlParam(HeaderType.Syncopation, syncopationPct - 3);
    });
  }
  increaseOffbeatSyncopation() {
    this.actAndResume(_ => {
      const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
      (HeaderType.Syncopation, syncopationPct + 3);
    });
  }

  decreaseDensity() {
    this.actAndResume(_ => {
      const densityPct = this.initialHeaders[HeaderType.Density];
      setUrlParam(HeaderType.Density, densityPct - 3);
    });
  }
  increaseDensity() {
    this.actAndResume(_ => {
      const densityPct = this.initialHeaders[HeaderType.Density];
      setUrlParam(HeaderType.Density, densityPct + 3);
    });
  }

  decrTimeSigUpperNumeral() {
    this.actAndResume(_ => {
      const timeSig = this.initialHeaders[HeaderType.Meter];
      if (timeSig.upperNumeral <= 2) {
        return;
      }
      timeSig.upperNumeral -= 1;
      setUrlParam(HeaderType.Meter, timeSig.toString());
    });
  }

  incrTimeSigUpperNumeral() {
    this.actAndResume(_ => {
      const timeSig = this.initialHeaders[HeaderType.Meter];
      timeSig.upperNumeral += 1;
      setUrlParam(HeaderType.Meter, timeSig.toString());
    });
  }

  incrementRepeat() {
    this.actAndResume(_ => {
      let repeat = this.initialHeaders[HeaderType.Repeat];
      repeat += 1;
      setUrlParam(HeaderType.Repeat, repeat);
    });
  }
  decrementRepeat() {
    this.actAndResume(_ => {
      let repeat = this.initialHeaders[HeaderType.Repeat];
      if (repeat <= 0) {
        return;
      }
      repeat -= 1;
      setUrlParam(HeaderType.Repeat, repeat);
    });
  }

  incrementBeatSubdivision() {
    this.actAndResume(_ => {
      let subdivision = this.initialHeaders[HeaderType.Subdivision];
      subdivision += 1;
      setUrlParam(HeaderType.Subdivision, subdivision);
    });
  }
  decrementBeatSubdivision() {
    this.actAndResume(_ => {
      let subdivision = this.initialHeaders[HeaderType.Subdivision];
      if (subdivision <= 1) {
        return;
      }
      subdivision -= 1;
      setUrlParam(HeaderType.Subdivision, subdivision);
    });
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
  }
  return keyVals;

}