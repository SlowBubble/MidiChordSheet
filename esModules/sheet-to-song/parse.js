
import { makeFrac } from "../fraction/fraction.js";
import { Chord } from '../chord/chord.js';
import { makeSpelling } from "../chord/spell.js";
import { TimeSig } from "../song-sheet/timeSigChanges.js";
import { Swing } from "../song-sheet/swingChanges.js";
import { chunkArray } from "../array-util/arrayUtil.js";
import { Song } from "../song-sheet/song.js";
import { QuantizedNoteGp } from "../song-sheet/quantizedNoteGp.js";
import { SongForm } from "./songForm.js";
import { CompingStyle, SongPart } from "./songPart.js";


export function parseSheetToSong(gridData, title) {
  const chordLocs = parseChordLocations(gridData);
  const headerLocs = parseHeaderLocations(gridData);
  const chordHeaderLocs = combineChordAndHeader(chordLocs, headerLocs, gridData.length);
  const chunkedLocs = chunkLocationsByPart(chordHeaderLocs);
  const chunkedLocsWithPickup = extractPickup(chunkedLocs);
  const songParts = toSongParts(chunkedLocsWithPickup);
  const possIntro = songParts.find(part => part.song.title.trim().toLowerCase() === 'intro');
  const possOutro = songParts.find(part => part.song.title.trim().toLowerCase() === 'outro');
  const body = songParts.filter(
    part => ['intro', 'outro'].indexOf(part.song.title.trim().toLowerCase()) < 0
  ).map(part => part.song.title);
  const songForm = new SongForm({
    title: title, parts: songParts,
    intro: possIntro ? possIntro.song.title : '',
    outro: possOutro ? possOutro.song.title : '',
    body: body,
  });
  return songForm.toSong();
}

// Returns [{song: Song, compingStyle: CompingStyle}]
function toSongParts(chunkedLocsWithPickup) {
  const partNameToPart = {};
  let currTimeSig;
  return chunkedLocsWithPickup.map(chunk => {
    const firstLoc = chunk.chordHeaderLocs[0];
    const headers = firstLoc.headers;
    let song = new Song({});
    const partForCopying = partNameToPart[headers[HeaderType.Copy]];
    if (partForCopying) {
      song = new Song(partForCopying.song);
    }
    song.title = headers[HeaderType.Part];
    
    if (headers[HeaderType.Meter]) {
      currTimeSig = headers[HeaderType.Meter];
    }
    if (currTimeSig) {
      song.timeSigChanges.defaultVal = currTimeSig;
    } else {
      currTimeSig = song.timeSigChanges.defaultVal;
    }
    if (headers[HeaderType.Tempo]) {
      song.tempo8nPerMinChanges.defaultVal = headers[HeaderType.Tempo];
    }
    const swing = headers[HeaderType.Swing];
    if (swing) {
      song.swingChanges.defaultVal = swing;
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
      if (loc.chordType === ChordInfoType.Slot) {
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
    song.getVoice(0).noteGps = [new QuantizedNoteGp({
      start8n: song.pickup8n.negative(),
      end8n: end8n,
      realEnd8n: end8n,
    })];

    const part = new SongPart({song: song});
    partNameToPart[song.title] = part;
    return part;
  });
}

function chunkLocationsByPart(chordHeaderLocs) {
  const zerothLoc = chordHeaderLocs.find(loc => loc.fractionalIdx.equals(0));
  if (!zerothLoc.headers) {
    zerothLoc.headers = {};
  }
  if (!zerothLoc.headers[HeaderType.Part]) {
    // Use colons to avoid name collision.
    zerothLoc.headers[HeaderType.Part] = '::Unnamed::';
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
      const possKeyVal = cell.split(':');
      if (possKeyVal.length !== 2) {
        return;
      }
      try {
        const {type, value} = processKeyVal(
          possKeyVal[0].trim().toLowerCase(),
          possKeyVal[1].trim().toLowerCase());
        return {
          type: type,
          value: value,
          rowIdx: rowIdx,
          colIdx: colIdx,
        };
      } catch (err) {
        console.warn('Failed to parse a potential header: ', cell)
      }
    }).filter(res => res);
  });
}

const HeaderType = Object.freeze({
  Key: 'Key',
  Meter: 'Meter',
  Swing: 'Swing',
  Tempo: 'Tempo',
  Part: 'Part',
  Copy: 'Copy',
  CompingStyle: 'CompingStyle'
});

function processKeyVal(key, valStr) {
  switch(key) {
    case 'key':
    case 'k':
      // TODO handle error.
      return {
        type: HeaderType.Key,
        value: makeSpelling(valStr),
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
      // Light swing by default.
      let ratio = makeFrac(3, 2);
      if (valStr === 'heavy' || valStr === 'hard') {
        ratio = makeFrac(5, 2);
      } else if (valStr === 'medium' || valStr === 'triplet') {
        ratio = makeFrac(2);
      }
      // TODO think of whether user need to control what type of note (8th note, quarter note, etc.) to swing using dur8n.
      return {
        type: HeaderType.Swing,
        value: new Swing({ratio: ratio})
      };
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
    case 'repeat':
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
    // case 'form':
    //   // E.g. (a-b)-c Makes it possible to extend the song as (a-b)-(a-b)-c
    default:
      console.warn('Unknown header key: ', key);
  }
}

const ChordInfoType = Object.freeze({
  Chord: 'Chord',
  // Used for spacing
  Blank: 'Blank',
  // Used for a copied section.
  Slot: 'Slot',
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
      cell = cell.trim();
      if (!cell) {
        return;
      }
      // Header.
      if (cell.includes(':')) {
        if (zeroTimeColIdx === null) {
          zeroTimeColIdx = colIdx
        }
        return;
      }
      const chordInfos = parseStringIntoChordInfos(cell);
      const len = chordInfos.length;
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

      chordInfos.forEach((info, idx) => {
        info.cellIdx = currCellIdx
        info.fractionalIdx = makeFrac(idx, len).plus(currCellIdx);
        info.isNewLine = idx === 0 && isNewLine;
        info.rowIdx = rowIdx;
        info.colIdx = colIdx;
        info.zeroTimeColIdx = zeroTimeColIdx;
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
    return true;
  }).map(text => {

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

