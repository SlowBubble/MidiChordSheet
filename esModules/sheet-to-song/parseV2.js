import { parseKeyValsToSongInfo, processKeyVal, HeaderType, defaultPartName } from "./parse.js";
import { parseCell, TokenType } from "../sheet-melody/parseSheet.js";
import { chunkArray } from "../array-util/arrayUtil.js";
import { Voice } from "../song-sheet/voice.js";
import { VoiceSettings } from "../song-sheet/voiceSettings.js";
import { instruments } from "../musical-sound/musicalSound.js";
import { makeFrac } from "../fraction/fraction.js";
import { makeSimpleQng } from "../song-sheet/quantizedNoteGp.js";

export function parseKeyValsToSongInfo2(keyVals) {
  const gridData = JSON.parse(keyVals.data);

  // 1. Group the cells into header, chord and voice.
  const groupedCells = groupCells(gridData);
  // 2. Attach the headers to the appropriate cell.
  const annotatedCells = combineHeadersWithCells(groupedCells, gridData.length);

  // 3. Chunk the cells into parts.
  const parts = chunkCellsToParts(annotatedCells);
  
  // 4a. Make it work for voice first.
  const voiceParts = parts.filter(part => part.type === CellType.Voice);
  const songInfo = parseKeyValsToSongInfo(keyVals);
  voiceParts.forEach(voicePart => {
    // TODO handle multiple voiceParts that use the same (chord) part.
    const songPart = songInfo.songParts.find(songPart => songPart.song.title === voicePart.name);
    addVoiceToSong(voicePart, songPart);
  });
  return songInfo;

  // 4b. Migrate chords over.
  // // 4. Initialize the context headers.
  // const contextHeaders = initContextHeaders();
  // overrideFromUrlParams(contextHeaders, keyVals);
  
  // // 5. Use the context headers to interpret each cell, updating the context when encountering a new header.
  // const songParts = convertToSongParts(parts, contextHeaders);
}

// TODO add baseVoicePart, which is needed for looking up a slot in the voicePart
function addVoiceToSong(voicePart, songPart) {
  const durPerMeasure8n = songPart.song.timeSigChanges.defaultVal.getDurPerMeasure8n();
  let seenNonblankToken = false;
  const tokenInfos = voicePart.pickupCells.concat(voicePart.cells).flatMap((cell, idx) => {
    idx = idx - voicePart.pickupCells.length;
    const tokens = parseCell(cell.val.toLowerCase());
    let start8nRelIdx = makeFrac(0);
    return tokens.map(token => {
      const res = {
        token: token,
        start8n: durPerMeasure8n.times(start8nRelIdx.plus(idx)),
        end8n: durPerMeasure8n.times(start8nRelIdx.plus(token.relDur).plus(idx)),
      };
      start8nRelIdx = start8nRelIdx.plus(token.relDur);
      if (token.type !== TokenType.Blank) {
        seenNonblankToken = true;
      }
      if (!seenNonblankToken) {
        return;
      }
      return res;
    }).filter(info => info);
  });
  const chunksStartingWithNonblank = chunkArray(tokenInfos, tokenInfo => tokenInfo.token.type !== TokenType.Blank);
  const noteGps = chunksStartingWithNonblank.map(chunk => {
    const tokenInfo = chunk[0];
    const start8n = tokenInfo.start8n;
    const end8n = chunk[chunk.length - 1].end8n;
    const token = tokenInfo.token;
    if (token.type === TokenType.Note) {
      return makeSimpleQng(start8n, end8n, [token.noteInfo.toNoteNum()], 0 , 99);
    }
    if (token.type === TokenType.Rest) {
      return makeSimpleQng(start8n, end8n, []);
    }
  });
  const voice = new Voice({
    noteGps: noteGps,
    settings: new VoiceSettings({instrument: instruments.electric_piano_1}),
  });
  songPart.song.voices = [voice];
}

// function convertToSongParts(parts, contextHeaders) {
// }
// function overrideFromUrlParams(contextHeaders, keyVals) {
//   Object.entries(keyVals).forEach(([key, val]) => {
//     const res = processKeyVal(
//       key.trim().toLowerCase(),
//       val.trim());
//     if (!res) {
//       return;
//     }
//     contextHeaders.set(res.type, res.value);
//   });
// }
// function initContextHeaders() {
//   const song = new Song({});
//   const headers = new Map;
//   headers.set(HeaderType.Meter, song.timeSigChanges.defaultVal);
//   headers.set(HeaderType.Tempo, song.tempo8nPerMinChanges.defaultVal);
//   headers.set(HeaderType.Key, song.keySigChanges.defaultVal);
//   headers.set(HeaderType.Swing, song.swingChanges.defaultVal);
//   headers.set(HeaderType.Transpose, 0);
//   headers.set(HeaderType.Syncopation, 20);
//   headers.set(HeaderType.Density, 20);
//   headers.set(HeaderType.Repeat, 0);
//   return headers;
// }

function chunkCellsToParts(cells) {
  const firstCellWithHeaders = cells.find(cell => cell.headerValByType.size > 0);
  const zeroTimeColIdx = firstCellWithHeaders ? firstCellWithHeaders.colIdx : 0;
  const chunks = chunkArray(cells, cell => cell.colIdx < zeroTimeColIdx ||
    cell.headerValByType.has(HeaderType.Part) ||
    cell.headerValByType.has(HeaderType.VoicePart));
  let pickupBuffer = [];
  let partsOrNull = chunks.map(chunk => {
    const firstCell = chunk[0];
    if (firstCell.colIdx < zeroTimeColIdx) {
      pickupBuffer.push(...chunk);
      return;
    }
    const type = firstCell.type;
    let partName = defaultPartName;
    if (firstCell.headerValByType.has(HeaderType.Part)) {
      partName = firstCell.headerValByType.get(HeaderType.Part);
    } else if (firstCell.headerValByType.has(HeaderType.VoicePart)) {
      partName = firstCell.headerValByType.get(HeaderType.VoicePart);
    }
    const res = new Part({cells: chunk, pickupCells: pickupBuffer, type: type, name: partName});
    pickupBuffer = [];
    return res;
  });
  return partsOrNull.filter(x => x);
}
function groupCells(gridData) {
  let isChordMode = true;
  const groupedCellsOrNull = gridData.flatMap((row, rowIdx) => {
    return row.map((val, colIdx) => {
      if (val === '') {
        return;
      }
      const cell = new Cell({val: val, rowIdx: rowIdx, colIdx: colIdx});
      if (val.split(':').length === 2) {
        const [key, valStr] = val.split(':');
        if (key.toLowerCase() === 'part') {
          isChordMode = true;
        } else if (key.toLowerCase().endsWith('part')) {
          isChordMode = false;
        }
        cell.type = CellType.Header;
        return cell;
      }
      cell.type = isChordMode ? CellType.Chord : CellType.Voice;
      return cell;
    });
  })
  return groupedCellsOrNull.filter(cell => cell);
}

function combineHeadersWithCells(cells, maxRows) {
  const nonheaders = cells.filter(cell => cell.type !== CellType.Header);
  const headers = cells.filter(cell => cell.type === CellType.Header);
  const nonHeaderCellsByIndices = new Map(nonheaders.map(cell => [cell.getIdxStr(), cell]));
  headers.forEach(header => {
    for (let possNonheaderRowIdx = header.rowIdx + 1; possNonheaderRowIdx < maxRows; possNonheaderRowIdx++) {
      const nonHeaderCell = nonHeaderCellsByIndices.get(getIdxStr(possNonheaderRowIdx, header.colIdx));
      if (!nonHeaderCell) {
        continue;
      }
      const [key, valStr] = header.val.split(':');
      const {type, value} = processKeyVal(key.trim().toLowerCase(), valStr.trim());
      nonHeaderCell.headerValByType.set(type, value);
      break;
    }
  });
  return nonheaders;
}

function getIdxStr(rowIdx, colIdx) {
  return `${rowIdx},${colIdx}`;
}

const CellType = {
  Unknown: "Unknown",
  Header: "Header",
  Chord: "Chord",
  Voice: "Voice",
}

class Cell {
  constructor({val = '', rowIdx, colIdx, type = CellType.Unknown, headerValByType = new Map}) {
    this.val = val;
    this.rowIdx = rowIdx;
    this.colIdx = colIdx;
    this.type = type;
    this.headerValByType = new Map(headerValByType);
  }
  getIdxStr() {
    return getIdxStr(this.rowIdx, this.colIdx);
  }
}

class Part {
  constructor({cells, pickupCells, type, name}) {
    this.cells = cells;
    this.pickupCells = pickupCells
    // Chord or Voice.
    this.type = type;
    this.name = name;
  }
}