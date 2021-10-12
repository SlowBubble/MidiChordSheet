import { Song } from "../song-sheet/song.js";
import { makeSimpleQng } from "../song-sheet/quantizedNoteGp.js";
import { clefType, Voice } from "../song-sheet/voice.js";
import { intervals } from "../chord/interval.js";
import { shuffle } from "../array-util/arrayUtil.js";

const num8nPerBeat = 2;

// TODO we will need to add structural info, such as whether this part is copied from
// another part, so that we can render a shorter version in the future.
export class SongPart {
  constructor({
    song = {}, // Song, which can have a melody or rest. Comping will be added in SongForm.
    compingStyle = CompingStyle.default,
    syncopationPct = 20,
    densityPct = 20,
    transpose = 0,
  }) {
    this.song = new Song(song);
    this.compingStyle = compingStyle;
    this.syncopationFactor = syncopationPct / 100;
    this.densityFactor = densityPct / 100;
    this.transpose = transpose;
  }

  // TODO remove
  updateComping() {
    const changes = this.song.chordChanges.changes;
    const bassQngs = [];
    const trebleQngs = [];

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
      if (idx === 0 && this.song.pickup8n.lessThan(change.start8n)) {
        bassQngs.push(makeSimpleQng(this.song.pickup8n, change.start8n, []));
        trebleQngs.push(makeSimpleQng(this.song.pickup8n, change.start8n, []));
      }
      // Bass
      const end8n = isFinalNote ? this.song.getEnd8n() : changes[idx + 1].start8n;
      const chord = change.val;
      const bass = chord.bass || chord.root;
      const bassNoteNum = genNearestNums([bass.toNoteNum()], [prevBassNoteNum], minBass, maxBass);
      const dur8n = end8n.minus(change.start8n);
      if (dur8n.greaterThan(durFor3Beats) || dur8n.lessThan(durFor2Beats)) {
        isDenseBass = false;
      } else {
        if (isDenseBass) {
          isDenseBass = Math.random() < this.densityFactor * 4;
        } else {
          isDenseBass = Math.random() < this.densityFactor * 1.5;
        }
      }
      const isDenseBaseForLongDur =  (dur8n.greaterThan(durFor3Beats) && Math.random() < this.densityFactor * 3);
      // Make this higher than bassNoteNum unless it's higher than maxBass
      let bassNoteNum2 = chord.root.toNoteNum(4);
      if ((isDenseBaseForLongDur || isDenseBass) && !isFinalNote) {
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
        let syncopateBass = dur8n.geq(8) ? Math.random() < this.syncopationFactor : Math.random() < this.syncopationFactor / 1.5;
        if (dur8n.equals(durFor3Beats)) {
          syncopateBass = false;
        }
        const dur8nFromEnd = syncopateBass ? 1 : 2;
        bassQngs.push(makeSimpleQng(change.start8n, end8n.minus(dur8nFromEnd), [bassNoteNum]));
        bassQngs.push(makeSimpleQng(end8n.minus(dur8nFromEnd), end8n, [bassNoteNum2]));
        prevBassNoteNum = bassNoteNum2;
      } else {
        bassQngs.push(makeSimpleQng(change.start8n, end8n, [bassNoteNum]));
        prevBassNoteNum = bassNoteNum;
      }
      
      const minTreble = Math.max(bassNoteNum, bassNoteNum2, 51) + 1;
      // Treble
      const specifiedColorNoteNums = chord.getSpecifiedColorNoteNums();
      const trebleNoteNums = genNearestNums(specifiedColorNoteNums, prevTrebleNoteNums, minTreble, maxTreble);
      // Tuned for the 3/4 meter song, "Someday My Prince Will Come"
      let isDenseTreble = false;
      if (dur8n.geq(durFor4Beats)) {
        isDenseTreble = (isDenseBaseForLongDur ?
          Math.random() < this.densityFactor * 3 :
          Math.random() < this.densityFactor * 4);
      } else if (dur8n.geq(durFor3Beats)) {
        isDenseTreble = (isDenseBaseForLongDur ?
          Math.random() < this.densityFactor :
          Math.random() < this.densityFactor * 2);
      }
      if (isDenseTreble && !isFinalNote) {
        const third = chord.root.toNoteNum() + chord.getThirdInterval();
        const seventh = chord.root.toNoteNum() + chord.getSeventhInterval();
        const fifth = chord.root.toNoteNum() + chord.getFifthInterval();
        const interval9Or11 = chord.isMinor() || chord.isDiminished() ? intervals.P4 :  intervals.M2;
        const ninthOr11th = chord.root.toNoteNum() + interval9Or11;
        const useFifth = Math.random() < 0.6;
        const color = useFifth ? fifth : ninthOr11th;
        let trebleNoteNums2 = genNearestNums([third, seventh, color], trebleNoteNums, minTreble, maxTreble);
        // For this to work, we need to unavoid clusters of 3 notes, in particular, if 11th or 13th is involved,
        // move them up and octave or move the 3 or 5 or 7 down an octave.
        // const colorNoteNums2 = shuffle(
        //   chord.getSpecifiedColorNoteNums(/* includeAll= */true, this.song.keySigChanges.defaultVal)).slice(0, 3);
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
        const syncopateFirstBeat = Math.random() < this.syncopationFactor / 2;
        let dur8nFromEnd;
        if (dur8n.equals(durFor3Beats)) {
          dur8nFromEnd = num8nPerBeat;
        } else {
          const syncopateLatterBeat = Math.random() < this.syncopationFactor;
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
        trebleQngs.push(makeSimpleQng(change.start8n, end8n, trebleNoteNums));
        prevTrebleNoteNums = trebleNoteNums;
      }
    });
    const trebleVoice = new Voice({
      noteGps: trebleQngs, clef: clefType.Treble,
    });
    const bassVoice = new Voice({noteGps: bassQngs, clef: clefType.Bass});
    // Having just one rest note means we should replace the voices entirely.
    if (this.song.voices[0].noteGps.length === 1 && this.song.voices[0].noteGps[0].midiNotes.length === 0 ) {
      this.song.voices = [trebleVoice, bassVoice];
    } else {
      this.song.addVoice(trebleVoice);
      this.song.addVoice(bassVoice);
    }
  }
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

// TODO move this to comping.js?
export const CompingStyle = Object.freeze({
  default: 'default',
})