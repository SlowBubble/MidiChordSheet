
// 55 is G3.
const startNoteNum = 54;
const musicKeys = [
  'a',
  'z',
  's',
  'x',
  'd',
  'c',
  'v',
  'g',
  'b',
  'h',
  'n',
  'm',
  'k',
  ',',
  'l',
  '.',
  ';',
  '/',
  "'",
  ']',
  '[',
  '-',
  'p',
  'o',
  '9',
  'i',
  '8',
  'u',
  '7',
  'y',
  't',
  '5',
  'r',
  '4',
  'e',
  'w',
  '2',
  'q',
  '1',
  '`',
];

export const keyToNoteNum = {};
musicKeys.forEach((key, idx) => {
  keyToNoteNum[key] = startNoteNum + idx;
});
