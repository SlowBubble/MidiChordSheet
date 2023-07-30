import { genChunkedLocs, processKeyVal, HeaderType, defaultPartName, genChordOnlySongForm, createInitialHeaders } from "./parse.js";
import { parseCell, TokenType } from "../sheet-melody/parseSheet.js";
import { chunkArray } from "../array-util/arrayUtil.js";
import { Voice } from "../song-sheet/voice.js";
import { VoiceSettings } from "../song-sheet/voiceSettings.js";
import { instruments } from "../musical-sound/musicalSound.js";
import { makeFrac } from "../fraction/fraction.js";
import { makeSimpleQng, QuantizedNoteGp } from "../song-sheet/quantizedNoteGp.js";

export function parseKeyValsToSongInfo(gridData, keyVals) {
  // 1. Group the cells into header, chord and voice.
  const groupedCells = groupCells(gridData);
  // 2. Attach the headers to the appropriate cell.
  const annotatedCells = combineHeadersWithCells(groupedCells, gridData.length);

  // 3. Chunk the cells into cellsParts.
  const cellsParts = chunkCellsToParts(annotatedCells);

  // TODO replace usages of chunkedLocsWithPickup with cellsParts and remove genChunkedLocs.
  const chunkedLocsWithPickup = genChunkedLocs(gridData);
  const initialHeaders = createInitialHeaders(chunkedLocsWithPickup, keyVals);
  const songForm = genChordOnlySongForm(chunkedLocsWithPickup, initialHeaders, keyVals);

  // 4a. Make it work for voice first.
  genSongPartsWithVoice(cellsParts, songForm);

  return {
    initialHeaders: initialHeaders,
    songForm: songForm,
  };

  // 4b. Migrate chords over.
  // // 4. Initialize the context headers.
  // const contextHeaders = initContextHeaders();
  // overrideFromUrlParams(contextHeaders, keyVals);
  
  // // 5. Use the context headers to interpret each cell, updating the context when encountering a new header.
  // const songParts = convertToSongParts(cellsParts, contextHeaders);
}

function genSongPartsWithVoice(cellsParts, songForm) {
  const voiceCellsParts = cellsParts.filter(part => part.type === CellType.Voice);
  const songParts = songForm.getParts();

  addVoicePartsToSongParts(voiceCellsParts, songParts);

  const lyricsCellsParts = cellsParts.filter(part => part.type === CellType.Lyrics);
  addLyricsPartsToSongParts(lyricsCellsParts, songParts);

  return songParts;
}

// TODO in the future, if there are multiple voiceCellsParts, do it here;
// will need to implement muting of repeated voiceCellsPart here (i.e. revert the "supress" changes).
function addVoicePartsToSongParts(voiceCellsParts, songParts) {
  const numIndices = Math.max(1, ...voiceCellsParts.map(part => part.index + 1));
  songParts.forEach(songPart => {
    const partName = songPart.song.title;
    for (let idx = 0; idx < numIndices; idx++) {
      const voiceCellsPart = voiceCellsParts.find(
        voiceCellsPart => partName === voiceCellsPart.name && idx === voiceCellsPart.index);
      if (!voiceCellsPart) {
        // Insert an empty voice with the correct duration if the voice is not specified
        // for a particular part name.
        addVoiceToSong(null, songPart, null, idx);
        continue;
      }
      let baseSongPart;
      if (voiceCellsPart.cells.length) {
        const partToCopy = voiceCellsPart.cells[0].headerValByType.get(HeaderType.Copy);
        if (partToCopy) {
          baseSongPart = songParts.find(songPart => songPart.song.title === partToCopy);
        }
      }
      addVoiceToSong(voiceCellsPart, songPart, baseSongPart, idx);
    }
  });
}

function addLyricsPartsToSongParts(lyricsCellsParts, songParts) {
  songParts.forEach(songPart => {
    const partName = songPart.song.title;
    const lyricsCellsPart = lyricsCellsParts.find(lyricsCellsPart => partName === lyricsCellsPart.name);
    if (!lyricsCellsPart) {
      return;
    }
    let baseLyricsPart;
    if (lyricsCellsPart.cells.length) {
      const partToCopy = lyricsCellsPart.cells[0].headerValByType.get(HeaderType.Copy);
      if (partToCopy) {
        baseLyricsPart = lyricsCellsParts.find(lp => lp.name === partToCopy);
      }
    }
    addLyricsToSong(lyricsCellsPart, songPart, baseLyricsPart);
  });
}

function addLyricsToSong(lyricsCellsPart, songPart, baseLyricsPart) {
  const qngs = songPart.song.getVoice(0).noteGps;
  const durPerMeasure8n = songPart.song.timeSigChanges.defaultVal.getDurPerMeasure8n();
  let baseCells = [];
  if (baseLyricsPart) {
    baseCells = baseLyricsPart.pickupCells.concat(baseLyricsPart.cells);
  }
  lyricsCellsPart.pickupCells.concat(lyricsCellsPart.cells).forEach((cell, idxRelPickupCell) => {
    const idx = idxRelPickupCell - lyricsCellsPart.pickupCells.length;
    const barStart8n = durPerMeasure8n.times(idx);
    const barEnd8n = durPerMeasure8n.times(idx + 1);
    const relevantQngs = qngs.filter(
      qng => !qng.isRest && qng.start8n.geq(barStart8n) && qng.start8n.lessThan(barEnd8n));
    if (cell.val === '_') {
      return;
    }

    let lyricsStr = cell.val;
    if (cell.val === '-') {
      if (idxRelPickupCell < baseCells.length) {
        lyricsStr = baseCells[idxRelPickupCell].val;
      }
    }
    const tokens = parseLyricsCell(lyricsStr);
    tokens.forEach((token, tokenIdx) => {
      if (tokenIdx >= relevantQngs.length) {
        return;
      }
      let word = token;
      // Handle the case of '- - - blah blah'.
      if (token === '-') {
        if (idxRelPickupCell < baseCells.length) {
          const baseTokens = parseLyricsCell(baseCells[idxRelPickupCell].val);
          if (tokenIdx < baseTokens.length) {
            word = baseTokens[tokenIdx];
          }
        }
      }
      relevantQngs[tokenIdx].lyrics = word;
    });
  });
}

function parseLyricsCell(lyricsString) {
  const asianRegexStr = '[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]';
  // 'abc  def' => ['abc', 'def']
  return lyricsString.split(/[\s]+/)
    // '天如' => ['天', '如']
    // Not using splitAfter here because we want:
    // '天?' => ['天?']
    .flatMap(phrase => splitBefore(phrase, asianRegexStr))
    .filter(phrase => phrase !== '');
}

function splitBefore(phrase, delimiterSubregexString) {
  // use positive look-ahead so that the split doesn't remove the delimiter.
  return phrase.split(new RegExp(`(?=${delimiterSubregexString})`));
}

function addVoiceToSong(voiceCellsPart, songPart, baseSongPart, voiceIdx) {
  const isFirst = voiceIdx === 0;
  const durPerMeasure8n = songPart.song.timeSigChanges.defaultVal.getDurPerMeasure8n();
  let seenNonblankToken = false;
  const tokenInfos = voiceCellsPart === null ? [] : voiceCellsPart.pickupCells.concat(voiceCellsPart.cells).flatMap((cell, idx) => {
    idx = idx - voiceCellsPart.pickupCells.length;
    const tokens = parseCell(cell.val.toLowerCase());
    let start8nRelIdx = makeFrac(0);
    return tokens.map(token => {
      const start8n = durPerMeasure8n.times(start8nRelIdx.plus(idx));
      const res = {
        token: token,
        start8n: start8n,
        end8n: durPerMeasure8n.times(start8nRelIdx.plus(token.relDur).plus(idx)),
      };
      start8nRelIdx = start8nRelIdx.plus(token.relDur);
      if (token.type !== TokenType.Blank) {
        seenNonblankToken = true;
      }
      if (!seenNonblankToken && start8n.lessThan(0)) {
        return;
      }
      return res;
    }).filter(info => info);
  });
  if (tokenInfos.length && tokenInfos[0]) {
    songPart.song.pickup8n = tokenInfos[0].start8n;
  }
  const qngInfos = tokenInfos.flatMap(tokenInfo => {
    const start8n = tokenInfo.start8n;
    const end8n = tokenInfo.end8n;
    const token = tokenInfo.token;
    if (token.type === TokenType.Note) {
      const currKeySig = songPart.song.keySigChanges.getChange(start8n).val;
      return [{
        qng: makeSimpleQng(
          start8n, end8n,
          [token.noteInfo.toNoteNum(currKeySig)], 120,
          [token.noteInfo.getSpelling(currKeySig)]),
      }];
    }
    if (token.type === TokenType.Slot) {
      const baseMelody = baseSongPart.song.voices[voiceIdx];
      const relevantBaseNoteGps = baseMelody.noteGps.map(qng => new QuantizedNoteGp(qng)).filter(
        noteGp => noteGp.start8n.geq(start8n) && noteGp.start8n.lessThan(end8n));
      const res = [];
      const baseStart8n = relevantBaseNoteGps.length ? relevantBaseNoteGps[0].start8n : end8n;
      if (start8n.geq(0) && start8n.lessThan(baseStart8n)) {
        res.push({qng: makeSimpleQng(start8n, baseStart8n), extendFromPrev: true});
      }
      // Else if:
      if (start8n.lessThan(0) && makeFrac(0).lessThan(baseStart8n)) {
        res.push({qng: makeSimpleQng(makeFrac(0), baseStart8n), extendFromPrev: true});
      }
      res.push(...relevantBaseNoteGps.map(noteGp => {
        return {qng: new QuantizedNoteGp(noteGp)};
      }));
      const finalInfo = res[res.length - 1];
      finalInfo.qng.end8n = end8n;
      return res;
    }
    // Handle blank or rest tokens.
    return [{qng: makeSimpleQng(start8n, end8n), extendFromPrev: token.type === TokenType.Blank}];
  });
  let latestBaseIdx = 0;
  qngInfos.forEach((info, idx) => {
    if (info.extendFromPrev && idx > 0) {
      qngInfos[latestBaseIdx].qng.end8n = info.qng.end8n;
    } else {
      latestBaseIdx = idx;
    }
  });
  const noteGps = qngInfos
    .filter((info, idx) => !(info.extendFromPrev && idx > 0))
    .map(info => info.qng);
  const end8n = songPart.song.getEnd8n();
  if (noteGps.length) {
    const finalNoteGp = noteGps[noteGps.length - 1]
    if (finalNoteGp.end8n.lessThan(end8n)) {
      noteGps.push(makeSimpleQng(finalNoteGp.end8n, end8n));
    }
  } else {
    // For empty voice, just insert rest for the entire duration.
    noteGps.push(makeSimpleQng(makeFrac(0), end8n));
  }
  const voice = new Voice({
    noteGps: noteGps,
  });
  // TODO remove this and do it when joining.
  voice.settingsChanges.defaultVal = new VoiceSettings({instrument: instruments.electric_piano_2});
  if (isFirst) {
    songPart.song.voices = [voice];
  } else {
    songPart.song.voices.push(voice);
  }
}

// function convertToSongParts(cellsParts, contextHeaders) {
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
    cell.headerValByType.has(HeaderType.LyricsPart) ||
    cell.headerValByType.has(HeaderType.VoicePart));
  let pickupBuffer = [];
  let cellsPartsOrNull = chunks.map(chunk => {
    const firstCell = chunk[0];
    if (firstCell.colIdx < zeroTimeColIdx) {
      pickupBuffer.push(...chunk);
      return;
    }
    const type = firstCell.type;
    let partName = defaultPartName;
    let partIndex = 0;
    if (firstCell.headerValByType.has(HeaderType.Part)) {
      partName = firstCell.headerValByType.get(HeaderType.Part);
    } else if (firstCell.headerValByType.has(HeaderType.VoicePart)) {
      partName = firstCell.headerValByType.get(HeaderType.VoicePart).name;
      partIndex = firstCell.headerValByType.get(HeaderType.VoicePart).index;
    } else if (firstCell.headerValByType.has(HeaderType.LyricsPart)) {
      partName = firstCell.headerValByType.get(HeaderType.LyricsPart).name;
      partIndex = firstCell.headerValByType.get(HeaderType.LyricsPart).index;
    }
    const res = new CellsPart({cells: chunk, pickupCells: pickupBuffer, type: type, name: partName, index: partIndex});
    pickupBuffer = [];
    return res;
  });
  return cellsPartsOrNull.filter(x => x);
}

function groupCells(gridData) {
  let mode = CellType.Chord;
  const groupedCellsOrNull = gridData.flatMap((row, rowIdx) => {
    return row.map((val, colIdx) => {
      val = val.toString().trim();
      if (val === '') {
        return;
      }
      const cell = new Cell({val: val, rowIdx: rowIdx, colIdx: colIdx});
      if (val.split(':').length === 2) {
        const [key, valStr] = val.split(':');
        if (key.toLowerCase() === 'part') {
          mode = CellType.Chord;
        } else if (key.toLowerCase().startsWith('voice') || key.toLowerCase().startsWith('melody')) {
          mode = CellType.Voice;
        } else if (key.toLowerCase().startsWith('lyrics')) {
          mode = CellType.Lyrics;
        }
        cell.type = CellType.Header;
        return cell;
      }
      cell.type = mode;
      return cell;
    });
  });
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
      const typeVal = processKeyVal(key.trim().toLowerCase(), valStr.trim());
      if (typeVal) {
        nonHeaderCell.headerValByType.set(typeVal.type, typeVal.value);
        break;
      }
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
  Lyrics: "Lyrics",
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

class CellsPart {
  constructor({cells, pickupCells, type, name, index}) {
    this.cells = cells;
    this.pickupCells = pickupCells
    // Chord or Voice.
    this.type = type;
    this.name = name;
    // A number to distinguish the voices in a multi-voice part.
    this.index = index;
  }
}