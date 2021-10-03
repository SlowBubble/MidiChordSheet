import { makeFrac } from "../fraction/fraction.js";
import { SongPart } from "../sheet-to-song/songPart.js";
import { makeSvgElt } from "./svgUtil.js";
import { range } from "../array-util/arrayUtil.js";
import { mod } from "../math-util/mathUtil.js";

export class ChordSvgMgr {
  constructor(songParts, currTime8n) {
    songParts = songParts || [];
    currTime8n = currTime8n || makeFrac(0);
    this.songParts = songParts.map(part => new SongPart(part));
    this.currTime8n = currTime8n;
  }

  getSvgs() {
    let time8nInSong = makeFrac(0);
    const svgs = this.songParts.map(part => {
      const svg = genSvg(part, this.currTime8n, time8nInSong, {});
      svg.style['border-top'] = '1px solid black';
      svg.style['margin-top'] = '10px';
      svg.style['padding-top'] = '10px';
      time8nInSong = time8nInSong.plus(part.song.getEnd8n());
      return svg;
    });
    // TODO normalize all svgs to have the same x-coord for the first bar.
    return svgs;
  }

  // Returns whether or a new set of SVGs need to be generated.
  setCurrTime8n(currTime8n) {
    this.currTime8n = currTime8n ? currTime8n : makeFrac(0);
    return true;
  }
}


// TODO figure of how to handle overlapping text.
function genSvg(part, currTime8n, time8nInSong, {
  fontSize = 22, widthPerBar = 220, heightPerBar = 45,
  spacingBetweenBars = 30,
  barsPerLine = 4,
}) {
  const song = part.song;
  const fullHeight = heightPerBar + spacingBetweenBars;
  const durPerMeasure8n = song.timeSigChanges.defaultVal.getDurPerMeasure8n();
  const numBars = Math.ceil(song.getEnd8n().over(durPerMeasure8n).toFloat());
  const numLines = Math.ceil(numBars / barsPerLine);
  const barWidth = 3;
  function idxToPos(idx) {
    return {
      x: mod(idx, barsPerLine) * widthPerBar,
      y: fullHeight * Math.floor(idx / barsPerLine),
      nextX: (mod(idx, barsPerLine) + 1) * widthPerBar,
    }
  }
  const barElts = range(0, numBars).flatMap(idx => {
    const pos = idxToPos(idx);
    return [
      makeSvgElt('rect', {
        x: pos.x,
        y: pos.y,
        fill: 'black',
        width: barWidth, height: heightPerBar
      }),
      makeSvgElt('rect', {
        x: pos.nextX,
        y: pos.y,
        fill: 'black',
        width: barWidth, height: heightPerBar
      }),
    ];
  });

  function time8nToPos(time8n) {
    const barMargin = 5;
    const fracIdx = time8n.over(durPerMeasure8n).toFloat();
    const idx = Math.floor(fracIdx);
    const idxPos = idxToPos(idx);
    mod(idx, barsPerLine) * widthPerBar
    return {
      x: idxPos.x + barMargin + (fracIdx - idx) * (widthPerBar - barMargin),
      y: idxPos.y + heightPerBar / 2,
    }
  }

  // TODO deal with pickup chords.
  const textElts = song.chordChanges.getChanges().filter(change => {
    return change.start8n.geq(0);
  }).map(change => {
    const {x, y} = time8nToPos(change.start8n);
    const passed = time8nInSong.plus(change.start8n).leq(currTime8n);
    return makeSvgElt('text', {
      x: x, y: y, 'dominant-baseline': 'middle',
      'font-size': fontSize,
      'font-weight': passed ? 'bold' : 'normal',
      fill: passed ? 'red' : 'black',
    }, change.val.toPrettyString());
  });
  const margin = barWidth;
  const svg = makeSvgElt('svg', {
    height: fullHeight * numLines,
    width: widthPerBar * barsPerLine + margin,
  });
  svg.append(...textElts);
  svg.append(...barElts);

  return svg;
}