import { toSolfege } from "../solfege-util/solfege.js";
import { chunkArray } from "../array-util/arrayUtil.js";

export class LyricsDisplayer {
  constructor({currTimeSub, eBanner}) {
    this._voice = null;
    this._lyricsLines = [];
    this._solfegeLines = [];
    this._eBanner = eBanner;
    this.enabled = true;
    this.displaySolfege = false;

    // TODO make this more efficient.
    currTimeSub(time8n => {
      if (!this.enabled) {
        return;
      }
      const lines = this.displaySolfege  || this._lyricsLines.length === 0 ? this._solfegeLines : this._lyricsLines;
      let lastLineIdx;
      lines.forEach((line, idx) => {
        if (line[0].time8n.leq(time8n)) {
          lastLineIdx = idx;
        }
      });

      let startLineIdx;
      if (lastLineIdx === undefined) {
        startLineIdx = 0;
      } else if (lastLineIdx + 1 < lines.length) {
        startLineIdx = lastLineIdx;
      } else {
        startLineIdx = lastLineIdx - 1;
      }
      const twoLines = lines.slice(startLineIdx, startLineIdx + 2);
      const isEvenStartLineIdx = startLineIdx % 2 === 0;
      if (!isEvenStartLineIdx) {
        twoLines.reverse();
      }

      const msg = twoLines.map(line => {
        const leftPart = joinWordInfos(line.filter(info => info.time8n.leq(time8n)));
        const rightPart = joinWordInfos(line.filter(info => !info.time8n.leq(time8n)));
        const leftStr = `<span style='color:red;'>${leftPart}</span>`;
        if (rightPart) {
          const space = leftPart.endsWith('-') ? '&nbsp;' : '&nbsp;&nbsp;';
          return `${leftStr}${space}<span>${rightPart}</span>`;
        }
        return leftStr;
      }).join('<hr/>');
      this._eBanner.inProgress(msg, true);
    });
  }

  setVoice(voice) {
    this._voice = voice;
    const hasLyrics = voice.noteGps.some(ng => ng.lyrics);
    const lyricsWithTime8n = hasLyrics ? genLyricsWordsWithTime8n(voice) : [];
    this._lyricsLines = genLines(lyricsWithTime8n, lyricsWithTime8n).filter(line => line.length > 0);
    this._solfegeLines = genLines(genSolfegeWordsWithTime8n(voice), lyricsWithTime8n).filter(line => line.length > 0);
  }
}

function joinWordInfos(infos) {
  return infos.map(info => info.word).filter(word => word !== '_').join(' ').replaceAll('- ', '-');
  // TODO also need to make the timing correct.
  // return infos.map(info => info.word).filter(word => word && !word.startsWith('_')).join(' ').replaceAll('- ', '-');
}

const punctuations = [',', '.', '!', '?', '"'];
function genLines(wordsWithTime8n, lyricsWithTime8n) {
  lyricsWithTime8n = lyricsWithTime8n || [];
  let normalRange = wordsWithTime8n;
  let beyondRangeChunks = [];
  if (wordsWithTime8n.length > lyricsWithTime8n.length) {
    normalRange = wordsWithTime8n.slice(0, lyricsWithTime8n.length);
    const beyondRange = wordsWithTime8n.slice(lyricsWithTime8n.length);
    beyondRangeChunks = inferLines(beyondRange);
  }
  const normalRangeChunks = chunkArray(normalRange, (item, currChunk, idx) => {
    if (idx == 0) {
      return false;
    }
    const prevLyrics = lyricsWithTime8n[idx - 1].word;
    if (prevLyrics && punctuations.indexOf(prevLyrics[prevLyrics.length - 1]) >= 0) {
      return true;
    }
  });
  return normalRangeChunks.concat(beyondRangeChunks);
}
function inferLines(wordsWithTime8n) {
  const chunks = chunkArray(wordsWithTime8n, (item, currChunk, idx) => {
    if (currChunk.length < 3) {
      return false;
    }
    if (!item) {
      return true;
    }
    if (idx - 1 >= 0) {
      const prevItem = wordsWithTime8n[idx - 1];
      if (prevItem && prevItem.dur8n.geq(5)) {
        return true;
      }
    }
    return false;
  }).map(chunk => chunk.filter(obj => obj));
  return chunks.flatMap(chunk => {
    if (chunk.length <= 12) {
      return [chunk];
    }
    return chunkArray(chunk, (item, currChunk, idx) => {
      if (currChunk.length < 5) {
        return false;
      }
      if (idx - 1 >= 0) {
        const prevItem = chunk[idx - 1];
        if (prevItem && prevItem.dur8n.geq(3)) {
          return true;
        }
      }
    });
  });
}

function genSolfegeWordsWithTime8n(voice) {
  return voice.noteGps.map(ng => {
    if (ng.isRest) {
      return;
    }
    const topNote = ng.midiNotes[ng.midiNotes.length - 1];
    // TODO infer the spelling.
    if (!topNote.spelling) {
      return;
    }
    return {word: toSolfege(topNote.spelling.toString()), time8n: ng.start8n, dur8n: ng.end8n.minus(ng.start8n)};
  }).filter(obj => obj);
}

function genLyricsWordsWithTime8n(voice) {
  return voice.noteGps.map(ng => {
    if (ng.isRest) {
      return;
    }
    return {word: ng.lyrics, time8n: ng.start8n, dur8n: ng.end8n.minus(ng.start8n)};
  }).filter(obj => obj);
}