import { genRhythms } from "./rhythm.js";
import { addNotesToRhythms } from "./voicing.js";
import { makeSimpleQng } from "../song-sheet/quantizedNoteGp.js";
import { clefType, Voice } from "../song-sheet/voice.js";
import { Intervals } from "../chord/interval.js";
import { TacticChanges, toTactic } from "../solo-tactics/tactics.js";
import { CompingStyle } from "../sheet-to-song/songPart.js";

const num8nPerBeat = 2;
const skipProbability = 0.5;
const alwaysSkip = 1;

export function updateTacticChanges(part) {
  part.song.tacticChanges = new TacticChanges({});
  const changes = part.song.getChordChangesAcrossBars(skipProbability);
  changes.forEach(change => {
    part.song.tacticChanges.upsert(change.start8n, toTactic(change.val, {level: 0.3}));
  });
}

export function addComping(part) {
  let {bassQngs, trebleQngs} = genNewComping(part);
  if (part.compingStyle === CompingStyle.default) {
    ({bassQngs, trebleQngs} = genDefaultComping(part));
  }
  const trebleVoice = new Voice({
    noteGps: trebleQngs, clef: clefType.Treble,
  });
  const bassVoice = new Voice({noteGps: bassQngs, clef: clefType.Bass});
  trebleVoice.settings.hide = true;
  bassVoice.settings.hide = true;
  part.song.addVoice(trebleVoice);
  part.song.addVoice(bassVoice);
}

function genNewComping(part) {
  const changes = part.song.getChordChangesAcrossBars(alwaysSkip);
  const bassQngs = [];
  const trebleQngs = [];

  const durFor8Beats = 8 * num8nPerBeat;
  const durFor4Beats = 4 * num8nPerBeat;
  const maxBass = 56;
  const minBass = 40;
  const maxTreble = 76;
  let prevBassNoteNum = 50;
  let prevTrebleNoteNums = [66];
  changes.forEach((change, idx) => {
    const isFinalNote = idx + 1 === changes.length;
    if (idx === 0 && part.song.pickup8n.lessThan(change.start8n)) {
      bassQngs.push(makeSimpleQng(part.song.pickup8n, change.start8n, []));
      trebleQngs.push(makeSimpleQng(part.song.pickup8n, change.start8n, []));
    }
    // Bass
    const end8n = isFinalNote ? part.song.getEnd8n() : changes[idx + 1].start8n;
    const chord = change.val;
    const bass = chord.bass || chord.root;
    const bassNoteNum = genNearestNums([bass.toNoteNum()], [prevBassNoteNum], minBass, maxBass);
    const dur8n = end8n.minus(change.start8n);
    // Make this higher than bassNoteNum unless it's higher than maxBass
    let bassNoteNum2 = chord.root.toNoteNum(4);
    if (chord.bass) {
      if (bassNoteNum2 > maxBass) {
        bassNoteNum2 -= 12;
      }
    } else {
      bassNoteNum2 = chord.root.toNoteNum(3) + chord.getFifthInterval();
      if (bassNoteNum2 < bassNoteNum && bassNoteNum2 + 12 < maxBass) {
        bassNoteNum2 += 12;
      }
    }

    function time(num8n) {
      return change.start8n.plus(num8n);
    }
    // Creating notes
    const choice1 = Math.random() < 0.5;
    const choice2 = Math.random() < 0.5;
    const choice3 = Math.random() < 0.5;
    const note2StartFor4Beats = choice2 ? 4 : 6;
    const note2StartFor8Beats = choice2 ? time(5) : time(6);
    if (dur8n.equals(durFor4Beats) && !isFinalNote) {
      if (choice2) {
      bassQngs.push(makeSimpleQng(time(0), time(3), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(3), time(5), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(5), time(8), [bassNoteNum2]));
      } else {
      bassQngs.push(makeSimpleQng(time(0), time(5), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(5), time(8), [bassNoteNum2]));
      }
    } else if (dur8n.equals(durFor8Beats) && !isFinalNote) {
      if (choice1) {
        bassQngs.push(makeSimpleQng(time(0), time(7), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(7), time(9), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(9), time(16), [bassNoteNum2]));
      } else {
        bassQngs.push(makeSimpleQng(time(0), time(11), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(11), time(13), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(time(13), time(16), [bassNoteNum2]));
      }
    } else {
      bassQngs.push(makeSimpleQng(change.start8n, end8n, [bassNoteNum]));
    }
    
    const minTreble = Math.max(bassNoteNum, bassNoteNum2, 51) + 1;
    // Treble
    const specifiedColorNoteNums = chord.getSpecifiedColorNoteNums();
    const trebleNoteNums = genNearestNums(specifiedColorNoteNums, prevTrebleNoteNums, minTreble, maxTreble);
    // Tuned for the 3/4 meter song, "Someday My Prince Will Come"
    const isSimpleMinorFour = (
      chord.isMinor() && !chord.hasExtension() &&
      Math.abs(chord.root.toNoteNum() - part.song.keySigChanges.defaultVal.toNoteNum()) === Intervals.P4);
    const third = chord.root.toNoteNum() + chord.getThirdInterval();
    const seventh = chord.root.toNoteNum() + chord.getSeventhInterval();
    const fifth = chord.root.toNoteNum() + chord.getFifthInterval();
    const interval9Or11 = chord.isMinor() || chord.isDiminished() ? Intervals.P4 :  Intervals.M2;
    const ninthOr11th = chord.root.toNoteNum() + interval9Or11;
    const interval6Or9Or11 = Math.random() < 0.6 ? Intervals.M6 : (Math.random() < 0.5 ? Intervals.M2 : Intervals.P4);
    const useFifth = Math.random() < 0.6;
    const color = useFifth ? fifth : ninthOr11th;
    const intervalsToUse = isSimpleMinorFour ? [third, fifth, chord.root.toNoteNum() + interval6Or9Or11] : [third, seventh, color];
    let trebleNoteNums2 = genNearestNums(intervalsToUse, trebleNoteNums, minTreble, maxTreble);
    // For this to work, we need to unavoid clusters of 3 notes, in particular, if 11th or 13th is involved,
    // move them up and octave or move the 3 or 5 or 7 down an octave.
    // const colorNoteNums2 = shuffle(
    //   chord.getSpecifiedColorNoteNums(/* includeAll= */true, part.song.keySigChanges.defaultVal)).slice(0, 3);
    // let trebleNoteNums2 = genNearestNums(colorNoteNums2, trebleNoteNums, minTreble, maxTreble);
    const topTrebleNoteNum = Math.max(...trebleNoteNums);
    const topTrebleNoteNum2 = Math.max(...trebleNoteNums2);
    if (topTrebleNoteNum === topTrebleNoteNum2) {
      if (Math.random() < 0.4) {
        trebleNoteNums2 = moveUp(trebleNoteNums2);
        if (Math.random() < 0.6) {
          trebleNoteNums2 = moveUp(trebleNoteNums2);
        }
      } else {
        trebleNoteNums2 = moveDown(trebleNoteNums2);
      }
    }
    if (dur8n.equals(durFor4Beats) && !isFinalNote) {
      trebleQngs.push(makeSimpleQng(time(0), time(note2StartFor4Beats), trebleNoteNums));
      trebleQngs.push(makeSimpleQng(time(note2StartFor4Beats), time(8), trebleNoteNums2));
    } else if (dur8n.equals(durFor8Beats) && !isFinalNote) {
      if (choice1) {
        const lastStart = choice3 ? 12 : 13;
        trebleQngs.push(makeSimpleQng(time(0), time(8), trebleNoteNums));
        trebleQngs.push(makeSimpleQng(time(8), time(lastStart), trebleNoteNums2));
        trebleQngs.push(makeSimpleQng(time(lastStart), time(16), trebleNoteNums2));
      } else {
        trebleQngs.push(makeSimpleQng(time(0), note2StartFor8Beats, trebleNoteNums));
        trebleQngs.push(makeSimpleQng(note2StartFor8Beats, time(12), trebleNoteNums2));
        trebleQngs.push(makeSimpleQng(time(12), time(16), trebleNoteNums2));
      }
    } else {
      trebleQngs.push(makeSimpleQng(change.start8n, end8n, trebleNoteNums));
    }
  });
  return {bassQngs, trebleQngs};
}

function genDefaultComping(part) {
  const changes = part.song.getChordChangesAcrossBars(skipProbability);
  const bassQngs = [];
  const trebleQngs = [];

  const durFor8Beats = 8 * num8nPerBeat;
  const durFor4Beats = 4 * num8nPerBeat;
  const durFor3Beats = 3 * num8nPerBeat;
  const durFor2Beats = 2 * num8nPerBeat;
  const maxBass = 56;
  const minBass = 40;
  const maxTreble = 76;
  let prevBassNoteNum = 50;
  let prevTrebleNoteNums = [66];
  let isDenseBass = false;
  changes.forEach((change, idx) => {
    const isFinalNote = idx + 1 === changes.length;
    if (idx === 0 && part.song.pickup8n.lessThan(change.start8n)) {
      bassQngs.push(makeSimpleQng(part.song.pickup8n, change.start8n, []));
      trebleQngs.push(makeSimpleQng(part.song.pickup8n, change.start8n, []));
    }
    // Bass
    const end8n = isFinalNote ? part.song.getEnd8n() : changes[idx + 1].start8n;
    const chord = change.val;
    const bass = chord.bass || chord.root;
    const bassNoteNum = genNearestNums([bass.toNoteNum()], [prevBassNoteNum], minBass, maxBass);
    const dur8n = end8n.minus(change.start8n);
    let quickBass = false;
    if (dur8n.greaterThan(durFor3Beats) || dur8n.lessThan(durFor2Beats)) {
      isDenseBass = false;
    } else {
      if (isDenseBass) {
        isDenseBass = Math.random() < part.densityFactor * 4;
      } else {
        isDenseBass = Math.random() < part.densityFactor * 1.5;
      }
    }
    let isDenseBaseForLongDur =  (dur8n.greaterThan(durFor3Beats) && Math.random() < part.densityFactor * 3);
    if (dur8n.greaterThan(durFor4Beats)) {
      isDenseBaseForLongDur = true;
    }
    // Make this higher than bassNoteNum unless it's higher than maxBass
    let bassNoteNum2 = chord.root.toNoteNum(4);
    if (chord.bass) {
      if (bassNoteNum2 > maxBass) {
        bassNoteNum2 -= 12;
      }
    } else {
      bassNoteNum2 = chord.root.toNoteNum(3) + chord.getFifthInterval();
      if (bassNoteNum2 < bassNoteNum && bassNoteNum2 + 12 < maxBass) {
        bassNoteNum2 += 12;
      }
    }

    // Creating notes
    if ((isDenseBaseForLongDur || isDenseBass) && !isFinalNote) {
      const syncopateBass = dur8n.geq(8) ? Math.random() < part.syncopationFactor * 1.3 : Math.random() < part.syncopationFactor / 1.3;
      const earlySyncopatedBass = syncopateBass && dur8n.geq(6) ? Math.random() < 0.6 : false;
      const dur8nFromEnd = syncopateBass ? (earlySyncopatedBass ? 3 : 1) : 2;
      bassQngs.push(makeSimpleQng(change.start8n, end8n.minus(dur8nFromEnd), [bassNoteNum]));
      bassQngs.push(makeSimpleQng(end8n.minus(dur8nFromEnd), end8n, [bassNoteNum2]));
      prevBassNoteNum = bassNoteNum2;
    } else {
      quickBass = dur8n.leq(durFor2Beats) ? Math.random() < part.syncopationFactor * 1.5 : false;
      if (quickBass && !isFinalNote) {
        bassQngs.push(makeSimpleQng(change.start8n, change.start8n.plus(num8nPerBeat - 1), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(change.start8n.plus(num8nPerBeat - 1), end8n, [bassNoteNum2]));
        prevBassNoteNum = bassNoteNum2;
      } else {
        bassQngs.push(makeSimpleQng(change.start8n, end8n, [bassNoteNum]));
        prevBassNoteNum = bassNoteNum;
      }
    }
    
    const minTreble = Math.max(bassNoteNum, bassNoteNum2, 51) + 1;
    // Treble
    const specifiedColorNoteNums = chord.getSpecifiedColorNoteNums();
    const trebleNoteNums = genNearestNums(specifiedColorNoteNums, prevTrebleNoteNums, minTreble, maxTreble);
    // Tuned for the 3/4 meter song, "Someday My Prince Will Come"
    let isDenseTreble = false;
    if (dur8n.greaterThan(durFor4Beats)) {
      isDenseTreble = true;
    } else if (dur8n.geq(durFor4Beats)) {
      isDenseTreble = (isDenseBaseForLongDur ?
        Math.random() < part.densityFactor * 3 :
        Math.random() < part.densityFactor * 4);
    } else if (dur8n.geq(durFor3Beats)) {
      isDenseTreble = (isDenseBaseForLongDur ?
        Math.random() < part.densityFactor :
        Math.random() < part.densityFactor * 2);
    }
    if (isDenseTreble && !isFinalNote) {
      const isSimpleMinorFour = (
        chord.isMinor() && !chord.hasExtension() &&
        Math.abs(chord.root.toNoteNum() - part.song.keySigChanges.defaultVal.toNoteNum()) === Intervals.P4);
      const third = chord.root.toNoteNum() + chord.getThirdInterval();
      const seventh = chord.root.toNoteNum() + chord.getSeventhInterval();
      const fifth = chord.root.toNoteNum() + chord.getFifthInterval();
      const interval9Or11 = chord.isMinor() || chord.isDiminished() ? Intervals.P4 :  Intervals.M2;
      const ninthOr11th = chord.root.toNoteNum() + interval9Or11;
      const interval6Or9Or11 = Math.random() < 0.6 ? Intervals.M6 : (Math.random() < 0.5 ? Intervals.M2 : Intervals.P4);
      const useFifth = Math.random() < 0.6;
      const color = useFifth ? fifth : ninthOr11th;
      const intervalsToUse = isSimpleMinorFour ? [third, fifth, chord.root.toNoteNum() + interval6Or9Or11] : [third, seventh, color];
      let trebleNoteNums2 = genNearestNums(intervalsToUse, trebleNoteNums, minTreble, maxTreble);
      // For this to work, we need to unavoid clusters of 3 notes, in particular, if 11th or 13th is involved,
      // move them up and octave or move the 3 or 5 or 7 down an octave.
      // const colorNoteNums2 = shuffle(
      //   chord.getSpecifiedColorNoteNums(/* includeAll= */true, part.song.keySigChanges.defaultVal)).slice(0, 3);
      // let trebleNoteNums2 = genNearestNums(colorNoteNums2, trebleNoteNums, minTreble, maxTreble);
      const topTrebleNoteNum = Math.max(...trebleNoteNums);
      const topTrebleNoteNum2 = Math.max(...trebleNoteNums2);
      if (topTrebleNoteNum === topTrebleNoteNum2) {
        if (Math.random() < 0.4) {
          trebleNoteNums2 = moveUp(trebleNoteNums2);
          if (Math.random() < 0.6) {
            trebleNoteNums2 = moveUp(trebleNoteNums2);
          }
        } else {
          trebleNoteNums2 = moveDown(trebleNoteNums2);
        }
      }
      const syncopateFirstBeat = Math.random() < part.syncopationFactor / 2;
      let dur8nFromEnd;
      if (dur8n.equals(durFor3Beats)) {
        dur8nFromEnd = num8nPerBeat;
      } else {
        const syncopateLatterBeat = Math.random() < part.syncopationFactor;
        const delaySyncopation = Math.random() < 0.25;
        const syncAmount = delaySyncopation ? -1 : 1;
        dur8nFromEnd = syncopateLatterBeat ? num8nPerBeat * 2 + syncAmount : num8nPerBeat * 2;
      }
      if (syncopateFirstBeat) {
        trebleQngs.push(makeSimpleQng(change.start8n, change.start8n.plus(num8nPerBeat - 1), []));
        trebleQngs.push(makeSimpleQng(change.start8n.plus(num8nPerBeat - 1), end8n.minus(dur8nFromEnd), trebleNoteNums));
      } else {
        trebleQngs.push(makeSimpleQng(change.start8n, end8n.minus(dur8nFromEnd), trebleNoteNums));
      }
      trebleQngs.push(makeSimpleQng(end8n.minus(dur8nFromEnd), end8n, trebleNoteNums2));
      prevTrebleNoteNums = trebleNoteNums2;
    } else {
      const syncopateFirstBeat = dur8n.leq(durFor2Beats) ? Math.random() < part.syncopationFactor * 1.5 : Math.random() < part.syncopationFactor;
      if (syncopateFirstBeat && !isFinalNote) {
        if (Math.random() < (quickBass ? 0.2 : 0.9) || change.start8n.plus(num8nPerBeat).equals(end8n)) {
          trebleQngs.push(makeSimpleQng(change.start8n, change.start8n.plus(num8nPerBeat - 1), []));
          trebleQngs.push(makeSimpleQng(change.start8n.plus(num8nPerBeat - 1), end8n, trebleNoteNums));
        } else {
          trebleQngs.push(makeSimpleQng(change.start8n, change.start8n.plus(num8nPerBeat), []));
          trebleQngs.push(makeSimpleQng(change.start8n.plus(num8nPerBeat), end8n, trebleNoteNums));
        }
      } else {
        trebleQngs.push(makeSimpleQng(change.start8n, end8n, trebleNoteNums));
      }
      prevTrebleNoteNums = trebleNoteNums;
    }
  });
  return {bassQngs, trebleQngs};
}
function moveUp(noteNums) {
  const bottom = Math.min(...noteNums);
  const res = noteNums.filter(num => num !== bottom);
  res.push(bottom + 12);
  return res;
}

function moveDown(noteNums) {
  const top = Math.max(...noteNums);
  const res = noteNums.filter(num => num !== top);
  res.push(top - 12);
  return res;
}

function genNearestNums(noteNums, prevNoteNums, min, max) {
  return noteNums.map(noteNum => fixNoteNum(genNearestNum(noteNum, prevNoteNums), min, max));
}

function genNearestNum(noteNum, prevNoteNums) {
  let minDist = null;
  let ans = noteNum;
  prevNoteNums.forEach(prevNoteNum => {
    let curr = noteNum;
    while (Math.abs(curr - prevNoteNum) > Math.abs(curr + 12 - prevNoteNum)) {
      curr += 12;
    }
    while (Math.abs(curr - prevNoteNum) > Math.abs(curr - 12 - prevNoteNum)) {
      curr -= 12;
    }
    const dist = Math.abs(curr - prevNoteNum);
    if (minDist === null || dist <= minDist) {
      minDist = dist;
      ans = curr;
    }
  });
  return ans;
}

function fixNoteNum(noteNum, min, max) {
  while (noteNum < min) {
    noteNum += 12;
  }
  while (noteNum > max) {
    noteNum -= 12;
  }
  return noteNum;
}


// export function genComping(songParts) {
//   const rhythms = songParts.map(part => genRhythms(part));
//   return addNotesToRhythms(rhythms, songParts);
// }