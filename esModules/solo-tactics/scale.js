

export const Scales = {
  chord_tones: ' arppeg.',
  pentatonic: ' penta.',
  minor_pentatonic: 'm penta.',
  // major: 'major',
  // lydian: 'lydian',
  // minor: 'minor', // natural
  // dorian: 'dorian',
  diminished: ' dim.',
  half_diminished: ' half dim.',
  diatonic: ' diatonic', // Catch-all to describe the church mode scales.
};


// function makeScale(name, intervals) {
//   return new ScaleInfo({name: name, intervals: intervals});
// }

// class ScaleInfo {
//   constructor({name, intervals}) {
//     this.name = name;
//     this.intervals = intervals;
//   }

//   getNoteSpellings(root, chord) {

//   }
// }

// const ScaleInfos = {
//   chord_tones: makeScale('arppeg.', [
//     0,
//     ch => ch.getThirdInterval(),
//     ch => ch.getFifthInterval(),
//     ch => ch.getSeventhInterval(),
//   ]),
//   pentatonic: makeScale('penta.', [0, 2, 4, 7, 9]),
//   minor_pentatonic: makeScale('min penta.', [0, 3, 5, 7, 10]),
//   // How do we make spelling correct?
//   diminished: 'dim. scale',
//   half_diminished: 'half dim. scale',
//   diatonic: 'diatonic', // Catch-all to describe the church mode scales.
// };
