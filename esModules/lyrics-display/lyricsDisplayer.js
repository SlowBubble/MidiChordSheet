import { toSolfege } from "../solfege-util/solfege.js";
import { chunkArray } from "../array-util/arrayUtil.js";

export class LyricsDisplayer {
  constructor({currTimeSub, eBanner}) {
    this._voice = null;
    this._lines = [];
    this._eBanner = eBanner;
    this._enabled = true;
    this._displaySolfege = true;

    // TODO make this more efficient.
    currTimeSub(time8n => {
      if (!this._enabled || this._lines.length === 0) {
        return;
      }
      let lastLineIdx;
      this._lines.forEach((line, idx) => {
        if (line[0].time8n.leq(time8n)) {
          lastLineIdx = idx;
        }
      });

      let startLineIdx;
      if (lastLineIdx === undefined) {
        startLineIdx = 0;
      } else if (lastLineIdx + 1 < this._lines.length) {
        startLineIdx = lastLineIdx;
      } else {
        startLineIdx = lastLineIdx - 1;
      }
      const twoLines = this._lines.slice(startLineIdx, startLineIdx + 2);
      const isEvenStartLineIdx = startLineIdx % 2 === 0;
      if (!isEvenStartLineIdx) {
        twoLines.reverse();
      }

      const msg = twoLines.map(line => {
        const leftPart = line.filter(info => info.time8n.leq(time8n)).map(info => info.word).join(' ');
        const rightPart = line.filter(info => !info.time8n.leq(time8n)).map(info => info.word).join(' ');
        return `<span style='color:red;'>${leftPart}</span> <span>${rightPart}</span>`;
      }).join('<hr/>');
      this._eBanner.inProgress(msg, true);
    });
  }
  setVoice(voice) {
    this._voice = voice;
    const wordsWithTime8n = genSolfegeWordsWithTime8n(voice);
    this._lines = genLines(wordsWithTime8n).filter(line => line.length > 0);
  }
}

function genLines(wordsWithTime8n) {
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
    if (!topNote.spelling) {
      return;
    }
    return {word: toSolfege(topNote.spelling.toString()), time8n: ng.start8n, dur8n: ng.end8n.minus(ng.start8n)};
  });
}