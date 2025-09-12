
import { makeFrac } from "../fraction/fraction.js";
import { Chord } from '../chord/chord.js';
import { fromNoteNumWithFlat, makeSpelling } from "../chord/spell.js";
import { TimeSig } from "../song-sheet/timeSigChanges.js";
import { Swing } from "../song-sheet/swingChanges.js";
import { chunkArray } from "../array-util/arrayUtil.js";
import { Song } from "../song-sheet/song.js";
import { QuantizedNoteGp } from "../song-sheet/quantizedNoteGp.js";
import { SongForm } from "./songForm.js";
import { CompingStyle, SongPart } from "./songPart.js";
import { computeBeatInfo } from "../musical-beat/pattern.js";


export function genChunkedLocs(gridData) {
  const chordLocs = parseChordLocations(gridData);
  const headerLocs = parseHeaderLocations(gridData);
  const chordHeaderLocs = combineChordAndHeader(chordLocs, headerLocs, gridData.length);
  const chunkedLocs = chunkLocationsByPart(chordHeaderLocs);
  const chunkedLocsWithPickup = extractPickup(chunkedLocs);

  return chunkedLocsWithPickup;
}

export function genChordOnlySongForm(chunkedLocsWithPickup, initialHeaders, keyVals) {
  const songParts = genChordOnlySongParts(chunkedLocsWithPickup, initialHeaders, keyVals);
  const possIntro = songParts.find(part => part.song.title.trim().toLowerCase() === 'intro');
  const possOutro = songParts.find(part => part.song.title.trim().toLowerCase() === 'outro');
  const body = songParts.filter(
    part => ['intro', 'outro'].indexOf(part.song.title.trim().toLowerCase()) < 0
  ).map(part => part.song.title);
  return new SongForm({
    title: keyVals.title, parts: songParts,
    intro: possIntro ? possIntro.song.title : '',
    outro: possOutro ? possOutro.song.title : '',
    body: body,
    numRepeats: initialHeaders[HeaderType.Repeat],
  });
}

// InitialHeaders are the headers used by the very first part of the song
// and is displayed on the sidebar. The values are determined by (in order of importance)
// 1. url params.
// 2. header in the first song part.
// 3. default values if they are required.
// 4. undefined if not required.
export function createInitialHeaders(chunkedLocsWithPickup, keyVals) {
  const song = new Song({});
  const headers = {};
  headers[HeaderType.Meter] = song.timeSigChanges.defaultVal;
  headers[HeaderType.Tempo] = song.tempo8nPerMinChanges.defaultVal;
  headers[HeaderType.Key] = song.keySigChanges.defaultVal;
  headers[HeaderType.Swing] = song.swingChanges.defaultVal;
  headers[HeaderType.Transpose] = 0;
  headers[HeaderType.Syncopation] = 20;
  headers[HeaderType.Density] = 20;
  headers[HeaderType.Repeat] = 0;

  if (chunkedLocsWithPickup.length > 0 &&
      chunkedLocsWithPickup[0].chordHeaderLocs.length > 0) {
    Object.entries(chunkedLocsWithPickup[0].chordHeaderLocs[0].headers).forEach(([key, val]) => {
      headers[key] = val;
    });
  }
  Object.entries(keyVals).forEach(([key, val]) => {
    if (!HeaderType[key]) {
      return;
    }
    const res = processKeyVal(
      key.trim().toLowerCase(),
      val.trim());
    if (!res) {
      return;
    }
    headers[res.type] = res.value;
  });

  if (!headers[HeaderType.Subdivision]) {
    headers[HeaderType.Subdivision] = computeBeatInfo(headers[HeaderType.Meter]).numBeatDivisions;
  }
  return headers;
}


function getInitialTransposedNum(headers) {
  let transposedNum = 0;
  if (headers[HeaderType.TransposedKey] !== undefined) {
    transposedNum += headers[HeaderType.TransposedKey].toNoteNum() - headers[HeaderType.Key].toNoteNum();
    if (transposedNum >= 6) {
      transposedNum -= 12;
    }
  }
  if (headers[HeaderType.TransposedNum] !== undefined) {
    transposedNum += headers[HeaderType.TransposedNum];
  }
  return transposedNum;
}

// TODO Separate local and global header, i.e. how they are interpreted and how
// they can be set; e.g. allowing setting local headers from the UI and url params
// only if they are never changed later or add some warning about unexpected behavior.

// Returns [{song: Song, compingStyle: CompingStyle}]
// TODO implement this spec
// What belongs in the global header types?
// Global headers are meant for every part of the song.
// Should be a relative value in order to be combined with the local header values.
// E.g. TransposedKey, TransposedNum, Repeat, TempoMultiplier
// Local header types are those that can changed for each part or even in the middle of a part.
// Local header are inherited from previous parts. Should be an absolute value.
// Currently, some local headers are confused as global header because they
// are usually only set once in the beginning,
// e.g. Meter, Key, Tempo, Subdivision, Swing

// New issue: the initialHeaders from url params (i.e. keyVals) should take precendence over the first part's headers.
function genChordOnlySongParts(chunkedLocsWithPickup, initialHeader, keyVals) {
  const partNameToPart = {};
  const partNameToInitialHeader = {};
  const initialTranposedNum = getInitialTransposedNum(initialHeader);

  let currTimeSig;
  let currTempo;
  let currSwing;
  let currSyncopation;
  let currDensity;

  let prevSong;

  return chunkedLocsWithPickup.map((chunk, idx) => {
    const firstLoc = chunk.chordHeaderLocs[0];
    // Copy the header because we will modify it below.
    const headers = Object.assign({}, firstLoc.headers);

    let song = new Song({});
    const partForCopying = partNameToPart[headers[HeaderType.Copy]];
    if (partForCopying) {
      song = new Song(partForCopying.song);
      const headersForMerging = partNameToInitialHeader[headers[HeaderType.Copy]];
      for (const [key, value] of Object.entries(headersForMerging)) {
        if (!(key in headers)) {
          headers[key] = value;
        }
      }
    } else {
      for (const [key, value] of Object.entries(initialHeader)) {
        // for idx > 0, only apply the global header types.
        const globalAndUnset = !(key in headers) && (idx == 0 || GlobalHeaderType.has(key));
        if (globalAndUnset || keyVals[key] !== undefined) {
          headers[key] = value;
        }
      }
    }
    song.title = headers[HeaderType.Part];

    // Pull data from headers or previous headers.
    // Lint(If change): sync with createInitialHeaders
    if (headers[HeaderType.Meter] !== undefined) {
      currTimeSig = headers[HeaderType.Meter];
    }
    song.timeSigChanges.defaultVal = currTimeSig;

    if (headers[HeaderType.Tempo] !== undefined) {
      currTempo = headers[HeaderType.Tempo];
    }
    if (headers[HeaderType.TempoMultiplier] !== undefined) {
      currTempo = headers[HeaderType.TempoMultiplier] / 100 * currTempo;
    }
    
    song.tempo8nPerMinChanges.defaultVal = currTempo;

    let currKeySig = headers[HeaderType.Key];
    if (!currKeySig && prevSong) {
      currKeySig = prevSong.keySigChanges.getChange(prevSong.getEnd8n()).val;
    }
    if (currKeySig) {
      song.keySigChanges.defaultVal = currKeySig;
      // Set the header key because it may need to be inherited by a later part via Copy.
      // TODO think about whether this is the correct thing to do, but only for Key
      // i.e. is Key the only local thing we should explicitly set for Copy? Meter, etc.
      headers[HeaderType.Key] = currKeySig;
    }

    const transpose = (
      headers[HeaderType.Transpose] === undefined ? initialTranposedNum :
      initialTranposedNum + headers[HeaderType.Transpose]
    );

    if (headers[HeaderType.Swing] !== undefined) {
      currSwing = headers[HeaderType.Swing];
    }
    song.swingChanges.defaultVal = currSwing;

    if (headers[HeaderType.Syncopation] !== undefined) {
      currSyncopation = headers[HeaderType.Syncopation];
    }

    if (headers[HeaderType.Density] !== undefined) {
      currDensity = headers[HeaderType.Density];
    }

    // Relative to the current part.
    const idxToTime8n = absoluteIdx => {
      const durPerCell8n = currTimeSig.getDurPerMeasure8n();
      // Flipping because absoluteIdx can be either a Number or Frac.
      const relIdx = firstLoc.fractionalIdx.minus(absoluteIdx).negative();
      return relIdx.times(durPerCell8n);
    };
    if (chunk.pickup.length > 0) {
      song.pickup8n = idxToTime8n(chunk.pickup[0].fractionalIdx)
    }

    chunk.pickup.concat(chunk.chordHeaderLocs).forEach(loc => {
      if (loc.headers) {
        const time8n = idxToTime8n(loc.fractionalIdx);
        if (loc.headers[HeaderType.Key]) {
          song.keySigChanges.upsert(time8n, loc.headers[HeaderType.Key]);
        }
        // TODO process other types of header type.
      }
      if (loc.chordType === ChordInfoType.Slot || loc.chordType === ChordInfoType.TurnAroundStart) {
        return;
      }
      const isFirstChordInCell = loc.fractionalIdx.isWhole();
      if (isFirstChordInCell) {
        // Clear out all the chords in the duration occupied by the cell.
        song.chordChanges.removeWithinInterval(
          idxToTime8n(loc.cellIdx),
          idxToTime8n(loc.cellIdx + 1));
      }

      if (loc.chordType === ChordInfoType.Chord) {
        const time8n = idxToTime8n(loc.fractionalIdx);
        song.chordChanges.upsert(time8n, loc.chord);
      }
    });
    const lastLoc = chunk.chordHeaderLocs[chunk.chordHeaderLocs.length - 1];
    const end8n = idxToTime8n(lastLoc.cellIdx + 1);
    song.chordChanges.removeWithinInterval(end8n);

    // Even though we will not use this voice later. We need it now for
    // getEnd8n to work correctly.
    song.getVoice(0).noteGps = [new QuantizedNoteGp({
      start8n: song.pickup8n,
      end8n: end8n,
      realEnd8n: end8n,
    })];

    const part = new SongPart({
      song: song, syncopationPct: currSyncopation,
      densityPct: currDensity, transpose: transpose,
    });
    const turnAroundLoc = chunk.chordHeaderLocs.find(loc => loc.chordType === ChordInfoType.TurnAroundStart);
    if (turnAroundLoc) {
      part.turnaroundStart8n = idxToTime8n(turnAroundLoc.fractionalIdx);
    }

    partNameToPart[song.title] = part;
    partNameToInitialHeader[song.title] = headers;
    prevSong = song;
    return part;
  });
}

export const defaultPartName = '::Unnamed::';

function chunkLocationsByPart(chordHeaderLocs) {
  const zerothLoc = chordHeaderLocs.find(loc => loc.fractionalIdx.equals(0));
  if (!zerothLoc.headers) {
    zerothLoc.headers = {};
  }
  if (!zerothLoc.headers[HeaderType.Part]) {
    // Use colons to avoid name collision.
    zerothLoc.headers[HeaderType.Part] = defaultPartName;
  }
  return chunkArray(chordHeaderLocs, loc => loc.headers && loc.headers[HeaderType.Part]);
}

// Returns [{pickup: [chorderHeaderLoc], chordHeaderLocs: [chordHeaderLocs]}]
function extractPickup(chunkedLocs) {
  // TODO suport pickup in later chunks.
  let chunkedLocsWithPickup;
  if (chunkedLocs[0][0].isPickup) {
    chunkedLocsWithPickup = chunkedLocs.slice(1).map((chunk, idx) => {
      let pickup = [];
      if (idx === 0) {
        // Throw away blank or slot chord type for pickup measure.
        const idx =  chunkedLocs[0].findIndex(loc => loc.chordType === ChordInfoType.Chord);
        if (idx === -1) {
          pickup = [];
        }
        pickup =  chunkedLocs[0].slice(idx);
      }
      return {
        pickup: pickup,
        chordHeaderLocs: chunk,
      };
    });
  } else {
    chunkedLocsWithPickup = chunkedLocs.map(chunk => {
      return {
        pickup: [],
        chordHeaderLocs: chunk,
      };
    });
  }
  return chunkedLocsWithPickup;
}

// [{fractionalIdx: Frac, cellIdx: Number, headers: ?{HeaderType: object},
//   chordType: ChordInfoType, chord: ?Chord, isNewLine: bool, isPickup: bool}]
function combineChordAndHeader(chordLocs, headerLocs, maxRows) {
  const chordLocByIndices = new Map();
  chordLocs.forEach(chordLoc => {
    chordLocByIndices.set(`${chordLoc.rowIdx},${chordLoc.colIdx}`, chordLoc);
  });
  const headersByCellIdx = new Map();
  headerLocs.forEach(headerLoc => {
    for (let chordRowIdx = headerLoc.rowIdx + 1; chordRowIdx < maxRows; chordRowIdx++) {
      const chordLoc = chordLocByIndices.get(`${chordRowIdx},${headerLoc.colIdx}`);
      if (!chordLoc) {
        continue;
      }

      let headers = headersByCellIdx.get(chordLoc.cellIdx);
      if (!headers) {
        headers = {};
        headersByCellIdx.set(chordLoc.cellIdx, headers)
      }
      headers[headerLoc.type] = headerLoc.value;
      break;
    }
  });
  return chordLocs.map(chordLoc => {
    const isFirstChordInCell = chordLoc.fractionalIdx.isWhole();
    return {
      fractionalIdx: chordLoc.fractionalIdx,
      cellIdx: chordLoc.cellIdx,
      chordType: chordLoc.type,
      chord: chordLoc.chord,
      // TODO See if we need to propagate more info from chordLoc.
      isNewLine: chordLoc.isNewLine,
      isPickup: chordLoc.colIdx < chordLoc.zeroTimeColIdx,
      headers: isFirstChordInCell ? headersByCellIdx.get(chordLoc.cellIdx) : undefined,
    }
  });
}

// Returns [{type: HeaderType, value: object, rowIdx: Number, colIdx: Number}]
function parseHeaderLocations(gridData) {
  return gridData.flatMap((row, rowIdx) => {
    return row.map((cell, colIdx) => {
      const possKeyVal = cell.toString().split(':');
      if (possKeyVal.length !== 2) {
        return;
      }
      const res = processKeyVal(
        possKeyVal[0].trim().toLowerCase(),
        possKeyVal[1].trim(), /* warnError= */ true);
      if (!res) {
        return;
      }
      return {
        type: res.type,
        value: res.value,
        rowIdx: rowIdx,
        colIdx: colIdx,
      };
    }).filter(res => res);
  });
}

// LINT If you add fields that are specific to a particular song, make sure to unset them in startNextSong.
export const HeaderType = Object.freeze({
  Key: 'Key',
  Meter: 'Meter',
  Swing: 'Swing',
  Tempo: 'Tempo',
  TempoMultiplier: 'TempoMultiplier',
  Part: 'Part',
  VoicePart: 'VoicePart',
  LyricsPart: 'LyricsPart',
  Copy: 'Copy',
  CompingStyle: 'CompingStyle',
  Syncopation: 'Syncopation',
  Density: 'Density',
  // Shift the entire song to this key, as supposed to `Key` 
  // Should be only be set once at the start.
  TransposedKey: 'TransposedKey',
  // Similar to TransposedKey but using a number instead and will
  // be applied on top of TransposedKey.
  TransposedNum: 'TransposedNum',
  // Shift the song by this number of semi-tones.
  // This can be set locally, and is interpreted relative to `TransposedKey`
  // if it exists, else `Key`.
  Transpose: 'Transpose',
  Repeat: 'Repeat',
  Subdivision: 'Subdivision',
  // TODO add a header for the ending to be dropped off when another part comes after.
});

export const GlobalHeaderType = new Set([
  HeaderType.TransposedKey,
  HeaderType.TransposedNum,
  HeaderType.Repeat,
  HeaderType.TempoMultiplier,
]);

export function processKeyVal(key, valStr, warnError) {
  switch(key) {
    case 'key':
    case 'k':
      // TODO handle error.
      const keyChord = new Chord(Parser.parse(valStr));
      return {
        type: HeaderType.Key,
        value: keyChord.root,
      };
    case 'time':
    case 'meter':
    case 'm':
      const [upper, lower] = valStr.split('/');
      return {
        type: HeaderType.Meter,
        value: new TimeSig({upperNumeral: parseInt(upper), upperNulowerNumeralmeral: parseInt(lower)}),
      };
    case 'swing':
      // No swing by default.
      let ratio = makeFrac(1, 1);
      valStr = valStr.toLowerCase();
      if (valStr === 'heavy' || valStr === 'hard') {
        ratio = makeFrac(5, 2);
      } else if (valStr === 'medium' || valStr === 'triplet') {
        ratio = makeFrac(2);
      } else if (valStr === 'light') {
        ratio = makeFrac(3, 2);
      } else if (valStr === 'no') {
        ratio = makeFrac(1);
      }
      return {
        type: HeaderType.Swing,
        value: new Swing({ratio: ratio})
      };
    case 'subdivision':
      return {
        type: HeaderType.Subdivision,
        value: parseInt(valStr),
      }
    case '8th-note-tempo':
    case 'tempo':
    case 'q':
      return {
        type: HeaderType.Tempo,
        value: parseInt(valStr),
      };
    case 'section':
    case 'part':
    case 'p':
      return {
        type: HeaderType.Part,
        value: valStr,
      };
    case 'voice':
    case 'voicepart':
      return {
        type: HeaderType.VoicePart,
        value: {
          name: valStr || defaultPartName,
          index: 0,
        },
      };
    case 'lyrics':
    case 'lyricspart':
      return {
        type: HeaderType.LyricsPart,
        value: {
          name: valStr || defaultPartName,
          index: 0,
        },
      };
    case 'voice1':
      return {
        type: HeaderType.VoicePart,
        value: {
          name: valStr || defaultPartName,
          index: 1,
        },
      };
    case 'lyrics1':
      return {
        type: HeaderType.LyricsPart,
        value: {
          name: valStr || defaultPartName,
          index: 1,
        },
      };
    case 'voice2':
      return {
        type: HeaderType.VoicePart,
        value: {
          name: valStr || defaultPartName,
          index: 2,
        },
      };
    case 'lyrics2':
      return {
        type: HeaderType.LyricsPart,
        value: {
          name: valStr || defaultPartName,
          index: 2,
        },
      };
    case 'repeat':
      return {
        type: HeaderType.Repeat,
        value: parseInt(valStr),
      };
    case 'copy':
      return {
        type: HeaderType.Copy,
        value: valStr,
      };
    case 'style':
      return {
        type: HeaderType.CompingStyle,
        value: CompingStyle[valStr] || CompingStyle.default,
      };
    case 'transpose':
      return {
        type: HeaderType.Transpose,
        value: parseInt(valStr),
      };
    case 'transposednum':
      return {
        type: HeaderType.TransposedNum,
        value: parseInt(valStr),
      };
    case 'transposedkey':
      const chord = new Chord(Parser.parse(valStr));
      return {
        type: HeaderType.TransposedKey,
        value: chord.root,
      };
    case 'tempomultiplier':
      return {
        type: HeaderType.TempoMultiplier,
        value: parseInt(valStr), 
      }
    case 'syncopation':
      return {
        type: HeaderType.Syncopation,
        value: parseInt(valStr),
      };
    case 'density':
      return {
        type: HeaderType.Density,
        value: parseInt(valStr),
      };
    // case 'form':
    //   // E.g. (a-b)-c Makes it possible to extend the song as (a-b)-(a-b)-c
    default:
      if (warnError) {
        console.warn('Unknown header key: ', key);
      }
  }
}

const ChordInfoType = Object.freeze({
  Chord: 'Chord',
  // Used for spacing
  Blank: 'Blank',
  // Used for a copied section.
  Slot: 'Slot',
  TurnAroundStart: 'TurnAroundStart',
  Unknown: 'Unknown',
});

// Returns [{type: ChordInfoType, chord: ?Chord, cellIdx: Number, fractionalIdx: Frac,
//    rowIdx: Number, colIdx: Number, zeroTimeColIdx, number, isNewLine: bool}]
function parseChordLocations(gridData) {
  const res = [];

  // TODO Should we use second row of chords to determin zeroTimeColIdx
  // instead of relying on the existence of key-value cell?
  // Determined fracIdx by looking at the first key-value cell.
  let zeroTimeColIdx = null;
  let currCellIdx = null;
  let isChordMode = true;

  const initCellIdxIfNeeded = colIdx => {
    if (zeroTimeColIdx === null) {
      console.warn('Encountered a chord before any header.');
      zeroTimeColIdx = colIdx;
      currCellIdx = 0;
      return;
    }
    if (currCellIdx === null) {
      currCellIdx = colIdx - zeroTimeColIdx;
    }
  };

  gridData.forEach((row, rowIdx) => {
    let lenientAboutErrors = false;
    let hasPrevErrorInRow = false;
    let isNewLine = true;
    row.forEach((cell, colIdx) => {
      if (hasPrevErrorInRow) {
        return;
      }
      cell = cell.toString().trim();
      if (!cell || cell.toLowerCase() === 'backing track') {
        return;
      }
      // Header.
      if (cell.includes(':')) {
        if (zeroTimeColIdx === null) {
          zeroTimeColIdx = colIdx
        }
        const key = cell.toLowerCase().split(':')[0];
        if (key === 'part') {
          isChordMode = true;
        } else if (key.endsWith('part') || key.toLowerCase().startsWith('voice') || key.toLowerCase().startsWith('melody')|| key.toLowerCase().startsWith('lyrics')) {
          isChordMode = false;
        }
        return;
      }

      if (!isChordMode) {
        return;
      }
      const chordInfos = parseStringIntoChordInfos(cell);
      const len = chordInfos.filter(info => info.type !== ChordInfoType.TurnAroundStart).length;
      if (len === 0) {
        return;
      }
      hasPrevErrorInRow = chordInfos.some(info => info.type === ChordInfoType.Unknown);
      if (hasPrevErrorInRow && !lenientAboutErrors) {
        return;
      }
      // Be lenient after successfully parsing chords in the first cell.
      lenientAboutErrors = true;
      initCellIdxIfNeeded(colIdx);

      let infoIdx = 0;
      chordInfos.forEach(info => {
        info.cellIdx = currCellIdx;
        info.fractionalIdx = makeFrac(infoIdx, len).plus(currCellIdx);
        info.isNewLine = infoIdx === 0 && isNewLine;
        info.rowIdx = rowIdx;
        info.colIdx = colIdx;
        info.zeroTimeColIdx = zeroTimeColIdx;

        if (info.type !== ChordInfoType.TurnAroundStart) {
          infoIdx++;
        }
      });
      isNewLine = false;
      currCellIdx += 1;
      res.push(...chordInfos);
    });
  });
  return res;
}

// Returns [{type: ChordInfoType, chord: ?Chord}]
function parseStringIntoChordInfos(cell) {
  return cell.split(' ').filter(text => {
    if (!text) {
      return false;
    }
    if (text === '|') {
      return false;
    }
    if (text === ')') {
      return false;
    }
    return true;
  }).map(text => {
    if (text === '(') {
      return {type: ChordInfoType.TurnAroundStart};
    }
    try {
      const chord = new Chord(Parser.parse(text.replaceAll('maj', 'M').replaceAll('-', 'm')));
      return {type: ChordInfoType.Chord, chord: chord}
    } catch (err) {
      if (text === '_') {
        return {type: ChordInfoType.Blank};
      }
      if (text === '-') {
        return {type: ChordInfoType.Slot};
      }
      console.warn('Failed to parse this as a chord: ', text);
      return {type: ChordInfoType.Unknown};
    }
  });
}

