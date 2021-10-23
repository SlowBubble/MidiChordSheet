import { makeRest, QuantizedNoteGp } from "./quantizedNoteGp.js";
import { VoiceSettings, SettingsChanges } from "./voiceSettings.js";

export const clefType = Object.freeze({
  Treble: 'Treble',
  Bass: 'Bass',
});

export class Voice {
  constructor({
    noteGps = [],
    lyricsTokens = [],
    clef = clefType.Treble,
    // settings = {},
    settingsChanges = {},
  }) {
    this.noteGps = noteGps.map(ng => new QuantizedNoteGp(ng));
    this.lyricsTokens = lyricsTokens;
    this.clef = clef;
    this.settingsChanges = new SettingsChanges(settingsChanges);
    // TODO: migrate away from the settings argument so we don't need to process it.
    // if (Object.keys(settings).length) {
    //   this.settingsChanges.defaultVal = new VoiceSettings(settings);
    // }
  }

  get settings() {
    return this.settingsChanges.defaultVal;
  }

  sanitizeNoteGps(pickup8n) {
    // 1. Make sure there are no gaps; give warning if there are overlaps.
    // Not worth fixing overlap, because we don't know the root cause.
    this.noteGps = this.noteGps.reduce((accum, noteGp, idx) => {
      if (idx == 0 && !pickup8n) {
        accum.push(noteGp);
        return accum;
      }

      const prevEnd8n = idx == 0 ? pickup8n : this.noteGps[idx - 1].end8n;
      if (prevEnd8n.lessThan(noteGp.start8n)) {
        accum.push(makeRest(prevEnd8n, noteGp.start8n));
      } else if (prevEnd8n.greaterThan(noteGp.start8n)) {
        console.warn('NoteGp has smaller start8n than expected (got, want): ', noteGp, prevEnd8n);
      }
      accum.push(noteGp);
      return accum;
    }, []);

    // 2. merge rests.
    this.noteGps = this.noteGps.reduce((accum, noteGp) => {
      if (!noteGp.isRest || accum.length == 0 || !accum[accum.length - 1].isRest) {
        accum.push(noteGp);
        return accum;
      }
      accum[accum.length - 1].end8n = noteGp.end8n;
      accum[accum.length - 1].realEnd8n = noteGp.end8n;
      return accum;
    }, []);
  }

  getAbcLyricsString() {
    return this.lyricsTokens.map(token => token.endsWith('-') ? token : token + ' ').join('');
  }
  fromAbcLyricsString(abcLyrics) {
    this.lyricsTokens = toLyricsTokens(abcLyrics);
  }
  insertAbcLyricsString(abcLyrics, idx) {
    const tokens = toLyricsTokens(abcLyrics);
    if (tokens.length == 0) {
      if (idx >= this.lyricsTokens.length) {
        return 0;
      }
      // When there are no tokens, we still need to splice if idx < this.lyricsTokens.length.
    }
    if (tokens.length > 0) {
      while (this.lyricsTokens.length < idx) {
        this.lyricsTokens.push('*');
      }
    }
    this.lyricsTokens.splice(idx, 1, ...tokens);
    return tokens.length;
  }
  getLyricsTokensWithCursor(cursorLyricsIdx) {
    const res = this.lyricsTokens.slice();
    if (cursorLyricsIdx === undefined) {
      return res;
    }
    while (res.length <= cursorLyricsIdx) {
      res.push('*');
    }
    const toBeDecorated = res[cursorLyricsIdx];
    res[cursorLyricsIdx] = toBeDecorated.indexOf(['_', '*']) >= 0 ? '?' : '?' + toBeDecorated;
    return res;
  }

  // The preferred way to add things to noteGps without introducing gaps.
  // pickup8n is needed to handle a possible gap in the left end by filling it with a rest.
  upsert(qngs, cursorStart8n, pickup8n) {
    this._upsertWithoutLeftAlignmentNorMergeRests(qngs, cursorStart8n);
    this.sanitizeNoteGps(pickup8n);
  }

  // mergeRests() {
  //   this.noteGps = this.noteGps.reduce((accum, noteGp) => {
  //     if (!noteGp.isRest || accum.length == 0 || !accum[accum.length - 1].isRest) {
  //       accum.push(noteGp);
  //       return accum;
  //     }
  //     accum[accum.length - 1].end8n = noteGp.end8n;
  //     accum[accum.length - 1].realEnd8n = noteGp.end8n;
  //     return accum;
  //   }, []);
  // }

  _upsertWithoutLeftAlignmentNorMergeRests(qngs, cursorStart8n) {
    if (qngs.length == 0) {
      return;
    }

    const earliestTime = qngs[0].start8n.plus(cursorStart8n);
    const latestTime = qngs[qngs.length - 1].end8n.plus(cursorStart8n);

    /** 0.   prev
     *     |------|
     *        |+++++++++|    */
    // Before branching into different cases, truncate prev.
    const prevIdx = this.noteGps.findIndex(noteGp => noteGp.end8n.greaterThan(earliestTime));
    if (prevIdx >= 0) {
      // If the earliestTime also cuts into the note before splice start, truncate the note.
      const prev = this.noteGps[prevIdx];
      if (prev.end8n.greaterThan(earliestTime)) {
        prev.end8n = earliestTime;
        if (prev.realEnd8n.greaterThan(earliestTime)) {
          prev.realEnd8n = earliestTime;
        }
      }
    }

    const translatedQngs = qngs.map(qng => new QuantizedNoteGp({
      ...qng,
      start8n: qng.start8n.plus(cursorStart8n),
      end8n: qng.end8n.plus(cursorStart8n),
      realEnd8n: qng.realEnd8n.plus(cursorStart8n),
    }));

    // Grace notes at the earliestTime wil be removed/spliced as well.
    // TODO if we more fine-grained control, pass in noteGpIdx
    const spliceStartIdx = this.noteGps.findIndex(noteGp => noteGp.start8n.geq(earliestTime));

    // 1. No overlap: ----|++++
    if (spliceStartIdx === -1) {
      // 2. Has gap: ----|    ++++
      if (this.noteGps.length > 0 && this.noteGps[this.noteGps.length - 1].end8n.lessThan(earliestTime)) {
        this.noteGps.push(makeRest(this.noteGps[this.noteGps.length - 1].end8n, earliestTime));
      }
      this.noteGps.push(...translatedQngs);
      return;
    }
    
    /** 3. prev  spliceStart   spliceEnd
     *     -----|------------|------
     *       ++++++| possGap |    */
    // 3a. deal with possGap
    let spliceEndIdx = this.noteGps.findIndex(noteGp => noteGp.start8n.geq(latestTime));
    spliceEndIdx = spliceEndIdx === -1 ? this.noteGps.length : spliceEndIdx;
    const spliceEnd = this.noteGps[spliceEndIdx];
    if (spliceEnd && spliceEnd.start8n.greaterThan(latestTime)) {
      translatedQngs[translatedQngs.length - 1].end8n = spliceEnd.start8n;
      translatedQngs[translatedQngs.length - 1].realEnd8n = spliceEnd.start8n;
    }
    // 3b. splice from spliceStartIdx to spliceEndIdx - 1.
    this.noteGps.splice(spliceStartIdx, spliceEndIdx - spliceStartIdx, ...translatedQngs);
  }
}

/* E.g.
[K:C] G   A c   f    e   G   G  A      c   d   c
w:   when-e-ver you need me, * I~will be there _ 

tokens:
['when-', 'e-', 'ver', 'you', 'need', 'me', '', 'I~will', 'be', 'there', '']

['when-ever'] => 'when\-ever'.
*/
function toLyricsTokens(lyricsString) {
  const asianRegexStr = '[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]';
  // 'abc  def' => ['abc', 'def']
  return lyricsString.split(/[\s]+/)
    // 'abc_def' => ['abc', '_', 'def']
    .flatMap(phrase => splitAndIncludeDelimiter(phrase, '_'))
    // 'abc*def' => ['abc', '*', 'def']
    .flatMap(phrase => splitAndIncludeDelimiter(phrase, '*'))
    // 'ab-cd' => ['ab-', 'cd']
    .flatMap(phrase => splitAfter(phrase, '-'))
    // '天如' => ['天', '如']
    // Not using splitAfter here because we want:
    // '天?' => ['天?']
    .flatMap(phrase => splitBefore(phrase, asianRegexStr))
    .filter(phrase => phrase !== '');
}

function splitAndIncludeDelimiter(phrase, delimiter) {
  const tokens = phrase.split(delimiter);
  return tokens.flatMap((token, idx) => {
    if (idx >= tokens.length - 1) {
      return [token];
    }
    return [token, delimiter];
  });
}

function splitBefore(phrase, delimiterSubregexString) {
  // use positive look-ahead so that the split doesn't remove the delimiter.
  return phrase.split(new RegExp(`(?=${delimiterSubregexString})`));
}

function splitAfter(phrase, delimiterSubregexString) {
  // use positive look-behind so that the split doesn't remove the delimiter.
  return phrase.split(new RegExp(`(?<=${delimiterSubregexString})`));
}
