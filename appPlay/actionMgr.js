import { HeaderType } from "../esModules/sheet-to-song/parse.js";
import { fromNoteNumWithFlat } from "../esModules/chord/spell.js";
import { joinSongParts } from "../esModules/sheet-to-song/songForm.js";
import { ChordSvgMgr } from "../esModules/chord-svg/chordSvg.js";
import { makeFrac } from "../esModules/fraction/fraction.js";
import { parseKeyValsToSongInfo2 } from "../esModules/sheet-to-song/parseV2.js";
import { shuffle, range } from "../esModules/array-util/arrayUtil.js";

export class ActionMgr {
  constructor({
    songReplayer,
    eBanner,
    renderMgr,
    menuDiv,
    metronomeBeatSub,
    playEndedSub,
    lyricsDisplayer,
  }) {
    this.songReplayer = songReplayer;
    this.eBanner = eBanner;
    this.renderMgr = renderMgr;
    this.menuDiv = menuDiv;
    this.song = null;
    this.initialHeaders = {};
    this.lyricsDisplayer = lyricsDisplayer;
    this.chordSvgMgr = new ChordSvgMgr({});
    this.displayChordsOnly = true;
    this.displayTactics = false;
    this.chordsCanvas = document.getElementById('chords-canvas');
    // null means play from the start with a bar of just beats.
    this.currTime8n = null;
    // Initialize these lazily.
    this.filePaths = null;
    this.reloadOnHashChange = true;

    metronomeBeatSub(beat => {
      this.setCurrTime8n(beat.time8n);
      if (this.displayChordsOnly) {
        this.renderChordsCanvas();
      }
    });

    playEndedSub(_ => {
      if (!this.filePaths) {
        return;
      }
      const waitMs = 2500;
      this.eBanner.success('Starting next song soon.')
      window.setTimeout( _ => this.startNextSong(), waitMs);
    });
    window.onhashchange = _ => {
      if (this.reloadOnHashChange) {
        this.actAndResume(async _ => {
          await this.reloadSong();
        });
      }
    };
  }

  async startNextSong() {
    this.songReplayer.stop();
    this.currTime8n = null;
    // Unset these.
    setUrlParam(HeaderType.Tempo);
    setUrlParam(HeaderType.Transpose);
    await this.reloadSong(/*goToNextTune=*/true);
    this.play();
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
  toggleImprovTactics() {
    this.displayTactics = !this.displayTactics;
    this.render();
  }
  toggleChordView() {
    this.displayChordsOnly = !this.displayChordsOnly;
    this.render();
  }
  toggleSolfegeLyrics() {
    this.lyricsDisplayer.displaySolfege = !this.lyricsDisplayer.displaySolfege;
    this.eBanner.success(this.lyricsDisplayer.displaySolfege ? 'Solfege' : 'Disabling solfege');
  }

  toggleLyrics() {
    this.lyricsDisplayer.enabled = ! this.lyricsDisplayer.enabled;
    this.eBanner.success(this.lyricsDisplayer.enabled ? 'Lyrics' : 'Disabling lyrics');
  }

  renderChordsCanvas() {
    this.chordsCanvas.innerHTML = '';
    const svgInfo = this.chordSvgMgr.getSvgInfo(this.displayTactics);
    this.chordsCanvas.append(svgInfo.svg);
    svgInfo.currentSvg.scrollIntoView({
      // This causes jerking motion for narrow screens when moving.
      // behavior: "smooth",
      block: "center",
    });
  }
  clearChordsCanvas() {
    this.chordsCanvas.innerHTML = '';
  }

  async reloadSong(goToNextTune) {
    const urlKeyVals = await getUrlKeyVals();
    let gridData;
    if (urlKeyVals.data) {
      gridData = JSON.parse(urlKeyVals.data);
    } else {
      if (!this.filePaths) {
        this.filePaths = await fetchFilePaths(urlKeyVals);
      }
      // TODO compute the first k songs (shuffled) and fetch them all at once to avoid offline issues.
      // This lock is needed because setting fileIdx causes a reload such that the song is not playing
      // but then it starts playing while awaiting for the reload to complete, so the new song is
      // set but the replayer is not restarted.
      // TODO add a method to setUrlParam without triggering reload.
      this.reloadOnHashChange = false;
      const fileData = await fetchFile(this.filePaths, urlKeyVals, goToNextTune);
      this.reloadOnHashChange = true;
      gridData = fileData.gridData;
      urlKeyVals.title = fileData.title;
      if (urlKeyVals[HeaderType.Transpose] === undefined) {
        urlKeyVals[HeaderType.Transpose] = `-${Math.floor(Math.random() * 12)}`;
      }
      if (urlKeyVals[HeaderType.Repeat] === undefined) {
        urlKeyVals[HeaderType.Repeat] = `${Math.floor(Math.random() * 2) + 1}`;
      }
      if (urlKeyVals[HeaderType.Syncopation] === undefined) {
        urlKeyVals[HeaderType.Syncopation] = `${Math.floor(Math.random() * 30) + 5}`;
      }
      if (urlKeyVals[HeaderType.Density] === undefined) {
        urlKeyVals[HeaderType.Density] = `${Math.floor(Math.random() * 30) + 5}`;
      }
    }

    const songInfo = parseKeyValsToSongInfo2(gridData, urlKeyVals);
    this.song = joinSongParts(songInfo.songParts, songInfo.songForm);
    this.initialHeaders = songInfo.initialHeaders;

    if (this.filePaths) {
      if (urlKeyVals[HeaderType.Tempo] === undefined) {
        this.song.tempo8nPerMinChanges.defaultVal *= (0.9 + Math.random() * 0.2);
        this.song.tempo8nPerMinChanges.defaultVal = Math.floor(this.song.tempo8nPerMinChanges.defaultVal);
        this.initialHeaders[HeaderType.Tempo] = this.song.tempo8nPerMinChanges.defaultVal; 
      }
    }

    const subdivisions = this.initialHeaders[HeaderType.Subdivision];
    const swingRatio = this.initialHeaders[HeaderType.Swing].ratio.toFloat();
    let swingStr = 'No';
    if (swingRatio >= 5/2) {
      swingStr = 'Hard';
    } else if (swingRatio >= 2) {
      swingStr = 'Medium';
    } else if (swingRatio > 1) {
      swingStr = 'Light';
    }
    if (subdivisions > 2 && swingRatio > 1) {
      swingStr += '*';
    }
    // Debug corrupted state.
    const key = (
      this.initialHeaders[HeaderType.TransposedKey] ?
      this.initialHeaders[HeaderType.TransposedKey] :
      fromNoteNumWithFlat(this.initialHeaders[HeaderType.Key].toNoteNum() + this.initialHeaders[HeaderType.Transpose]));
    document.getElementById('subdivision-display').textContent = subdivisions;
    document.getElementById('tempo-display').textContent = this.initialHeaders[HeaderType.Tempo];
    document.getElementById('swing-display').textContent = swingStr;
    document.getElementById('key-display').textContent = key;
    document.getElementById('repeat-display').textContent = this.initialHeaders[HeaderType.Repeat];
    document.getElementById('upper-numeral-display').textContent = this.initialHeaders[HeaderType.Meter].upperNumeral;

    this.lyricsDisplayer.setVoice(this.song.getVoice(0));
    this.chordSvgMgr = new ChordSvgMgr({
      songForm: songInfo.songForm,
      songParts: songInfo.songParts,
      currTime8n: this.currTime8n,
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

  async actAndResume(action) {
    const shouldStopAndResume = this.songReplayer.isPlaying();
    if (shouldStopAndResume) {
      this.songReplayer.stop();
    }
    const disableResume = await action();
    if (shouldStopAndResume && !disableResume) {
      this.play();
    }
  }

  move(numBars) {
    this.actAndResume(_ => {
      let disableResume = false;
      numBars = numBars || 1;
      const durPerMeasure8n = this.song.timeSigChanges.defaultVal.getDurPerMeasure8n();
      const currTime = this.currTime8n || makeFrac(0);
      const unroundedBarNum = currTime.over(durPerMeasure8n).toFloat();
      let barNum = numBars > 0 ? Math.ceil(unroundedBarNum) : Math.floor(unroundedBarNum);
      barNum += numBars;
  
      let newTime8n = null;
      if (barNum >= 0) {
        newTime8n = durPerMeasure8n.times(barNum);
        if (newTime8n.geq(this.song.getFinalChordTime8n())) {
          newTime8n = this.song.getFinalChordTime8n();
          disableResume = true;
        }
      }
      this.setCurrTime8n(newTime8n);
      this.render();
      return disableResume;
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
  }

  decreaseTempo() {
      const tempo = this.initialHeaders[HeaderType.Tempo];
      if (tempo - 10 <= 0) {
        return;
      }
      setUrlParam(HeaderType.Tempo, tempo - 10);
  }
  increaseTempo() {
      const tempo = this.initialHeaders[HeaderType.Tempo];
      setUrlParam(HeaderType.Tempo, tempo + 10);
  }

  transposeKeyDown() {
    this.actAndResume(_ => {
      const transpose = this.initialHeaders[HeaderType.Transpose];
      setUrlParam(HeaderType.Transpose, (transpose - 1) % 12);
    });
  }
  transposeKeyUp() {
    const transpose = this.initialHeaders[HeaderType.Transpose];
    setUrlParam(HeaderType.Transpose, (transpose + 1) % 12);
  }

  decreaseOffbeatSyncopation() {
    const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
    setUrlParam(HeaderType.Syncopation, syncopationPct - 3);
  }
  increaseOffbeatSyncopation() {
    const syncopationPct = this.initialHeaders[HeaderType.Syncopation];
    (HeaderType.Syncopation, syncopationPct + 3);
  }

  decreaseDensity() {
    const densityPct = this.initialHeaders[HeaderType.Density];
    setUrlParam(HeaderType.Density, densityPct - 3);
  }
  increaseDensity() {
    const densityPct = this.initialHeaders[HeaderType.Density];
    setUrlParam(HeaderType.Density, densityPct + 3);
  }

  decrTimeSigUpperNumeral() {
    const timeSig = this.initialHeaders[HeaderType.Meter];
    if (timeSig.upperNumeral <= 2) {
      return;
    }
    timeSig.upperNumeral -= 1;
    setUrlParam(HeaderType.Meter, timeSig.toString());
  }

  incrTimeSigUpperNumeral() {
    const timeSig = this.initialHeaders[HeaderType.Meter];
    timeSig.upperNumeral += 1;
    setUrlParam(HeaderType.Meter, timeSig.toString());
  }

  incrementRepeat() {
    let repeat = this.initialHeaders[HeaderType.Repeat];
    repeat += 1;
    setUrlParam(HeaderType.Repeat, repeat);
  }
  decrementRepeat() {
    let repeat = this.initialHeaders[HeaderType.Repeat];
    if (repeat <= 0) {
      return;
    }
    repeat -= 1;
    setUrlParam(HeaderType.Repeat, repeat);
  }

  incrementBeatSubdivision() {
    let subdivision = this.initialHeaders[HeaderType.Subdivision];
    subdivision += 1;
    setUrlParam(HeaderType.Subdivision, subdivision);
  }
  decrementBeatSubdivision() {
    let subdivision = this.initialHeaders[HeaderType.Subdivision];
    if (subdivision <= 1) {
      return;
    }
    subdivision -= 1;
    setUrlParam(HeaderType.Subdivision, subdivision);
  }
}

// Note that this will trigger a song reload.
function setUrlParam(key, val) {
  const url = toInternalUrl(document.URL);
  if (val !== undefined) {
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
  return keyVals;
}

async function fetchFilePaths(keyVals) {
  let files;
  if (keyVals.files) {
    files = JSON.parse(keyVals.files);
  }
  if (!files) {
    // Production (TODO use index.json instead but need to know how to handle json)
    if (keyVals.genre === 'jazz') {
      files = ['https://unpkg.com/@clubfest/jazz-tunes/index.json'];
    } else if (keyVals.genre === 'kids') {
      files = ['https://unpkg.com/@clubfest/kids-tunes/index.json'];
    } else if (keyVals.genre === 'pop') {
      files = ['https://unpkg.com/@clubfest/pop-tunes/index.json'];
    }  else if (keyVals.genre === 'cantopop') {
      files = ['https://unpkg.com/@clubfest/cantopop-tunes/index.json'];
    }  else if (keyVals.genre === 'all') {
      files = ['https://unpkg.com/@clubfest/tunes/index.json'];
    } else {
      files = ['https://unpkg.com/@clubfest/jazz-tunes/index.json'];
    }
    // Testing locally
    // files = ['examples/Ten%20Little%20Fingers%20-%20Reharm.tsv'];
  }
  const jsonFiles = files.filter(name => name.endsWith('.json'));
  let resps;
  if (jsonFiles.length) {
    resps = await Promise.all(jsonFiles.map(jsonFile => fetch(jsonFile)));
  }
  const tsvFiles = files.filter(name => name.endsWith('.tsv'));
  const jsons = await Promise.all(resps.map(resp => resp.json()));
  const filesFromJsons = jsons.flatMap((fileNames, idx) => fileNames.map(fileName => {
    const jsonPathComps = jsonFiles[idx].split('/');
    const dirPath = jsonPathComps.slice(0, jsonPathComps.length - 1).join('/');
    return `${dirPath}/${fileName}`;
  }));
  files = tsvFiles.concat(filesFromJsons);
  return files;
}

async function fetchFile(files, keyVals, goToNextTune) {
  let idx = keyVals.fileIdx;
  if (goToNextTune || keyVals.fileIdx === undefined) {
    const ordering = range(0, files.length);
    if (keyVals.fileIdx !== undefined && files.length > 1) {
      ordering.splice(keyVals.fileIdx, 1);
    }
    idx = shuffle(ordering)[0];
    setUrlParam('fileIdx', idx);
  }
  const filePath = files[idx];
  const pathComps = filePath.split('/');
  const fileName = decodeURI(pathComps[pathComps.length - 1]);
  const fileNameWithoutExt = fileName.split('.')[0];
  const title = fileNameWithoutExt.split(' - ')[0];
  const response = await fetch(filePath);
  const tsv = await response.text();
  return {
    gridData: tsv.split(/\r?\n/g).map(line => line.split('\t')),
    title: title,
  };
}