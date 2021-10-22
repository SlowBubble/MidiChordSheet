import { makeFrac } from "../fraction/fraction.js";
import { makeSvgElt, getBoundingBox } from "./svgUtil.js";
import { range, findLast } from "../array-util/arrayUtil.js";
import { mod } from "../math-util/mathUtil.js";
import { SongForm } from "../sheet-to-song/songForm.js";

// TODO don't hard code this.
const pickupStart8n = makeFrac(-99);

export class ChordSvgMgr {
  constructor({songForm = {}, songParts = [], currTime8n = pickupStart8n}) {
    this.songForm = new SongForm(songForm);
    this.songParts = songParts
    this.currTime8n = currTime8n || pickupStart8n;
  }

  getSvgsInfo() {
    let time8nInSong = makeFrac(0);
    const svgInfos = this.songParts.map(part => {
      const chordSvgInfo = genChordSvg(part, this.currTime8n, time8nInSong, {});
      time8nInSong = time8nInSong.plus(part.song.getEnd8n());
      if (part.song.title === '::Unnamed::') {
        return chordSvgInfo;
      }
      const partNameSvg = genPartNameSvg(part.song.title, {});  
      chordSvgInfo.svg = stackSvgs(partNameSvg, chordSvgInfo.svg);
      return chordSvgInfo;
    });
    const svgs = svgInfos.map(svgInfo => svgInfo.svg);
    // TODO normalize all svgs to have the same x-coord for the first bar.
    const maxWidth = Math.max(...svgs.map(svg => parseInt(svg.getAttribute('width'))));
    const titleText = makeSvgElt('text', {
      x: maxWidth / 2, y: 0, 'text-anchor': "middle", 'dominant-baseline': 'hanging',
      'font-size': 28,
    }, this.songForm.title);
    const titleSvg = makeSvgElt('svg', {width: maxWidth, height: 28 + 4});
    titleSvg.append(titleText);
    const passingSvgInfo = findLast(svgInfos, info => info.hasPassed);
    return {svgs: [titleSvg, ...svgs], currentSvg: passingSvgInfo ? passingSvgInfo.svg : titleSvg};
  }
  getSvgInfo() {
    const svgsInfo = this.getSvgsInfo();
    const svg = stackSvgs(...svgsInfo.svgs);
    svg.style['padding-top'] = '20px';
    return {svg: svg, currentSvg: svgsInfo.currentSvg};
  }

  // Returns whether or a new set of SVGs need to be generated.
  setCurrTime8n(currTime8n) {
    this.currTime8n = currTime8n ? currTime8n : pickupStart8n;
    return true;
  }
}

function stackSvgs(...svgs) {
  let currY = 0;
  let maxWidth = 0;
  svgs.forEach(svg => {
    svg.setAttribute('y', currY);
    currY += parseInt(svg.getAttribute('height'));
    maxWidth = Math.max(maxWidth, parseInt(svg.getAttribute('width')));
  });
  const svg = makeSvgElt('svg', {width: maxWidth, height: currY});
  svg.append(...svgs);
  return svg;
}

function genPartNameSvg(name, {bottomMargin = 10, xPadding = 6, yPadding = 2}) {
  const bbox = getBoundingBox(name, {'font-size': 22});
  const paddedWidth = bbox.width + 2 * xPadding;
  const paddedHeight = bbox.height + 2 * yPadding;
  const textSvg = makeSvgElt('text', {
    x: xPadding, y: paddedHeight / 2, 'dominant-baseline': 'central',
    'font-size': 22,
  }, name);
  const rectSvg = makeSvgElt('rect', {
    x: 0,
    y: 0,
    'fill': 'none',
    'stroke': 'black',
    width: paddedWidth, height: paddedHeight
  });
  const svg = makeSvgElt('svg', {
    height: paddedHeight + bottomMargin,
    width: paddedWidth,
  });
  svg.append(textSvg, rectSvg);
  return svg;
}
// TODO figure of how to handle overlapping text.
function genChordSvg(part, currTime8n, time8nInSong, {
  fontSize = 22, widthPerBar = 250, heightPerBar = 45,
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
  let hasPassed = false;
  const textElts = song.chordChanges.getChanges().filter(change => {
    return change.start8n.geq(0);
  }).map(change => {
    const {x, y} = time8nToPos(change.start8n);
    const passed = time8nInSong.plus(change.start8n).leq(currTime8n);
    hasPassed = hasPassed || passed;
    return makeSvgElt('text', {
      x: x, y: y, 'dominant-baseline': 'central',
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

  return {
    svg: svg,
    hasPassed: hasPassed,
  };
}