
// 55 is G3.
const startNoteNum = 54;
const musicKeys = [
  "'",
  '/',
  ';',
  '.',
  'l',
  ',',
  'm',
  'j',
  'n',
  'h',
  'b',
  'v',
  'f',
  'c',
  'd',
  'x',
  's',
  'z',
  'a',
  'q',
  'w',
  '3',
  'e',
  'r',
  '5',
  't',
  '6',
  'y',
  '7',
  'u',
  'i',
  '9',
  'o',
  '0',
  'p',
  '[',
  '=',
  ']',
];

export const keyToNoteNum = {};
musicKeys.forEach((key, idx) => {
  keyToNoteNum[key] = startNoteNum + idx;
});
