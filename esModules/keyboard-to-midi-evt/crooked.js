
// 48 is C4.
const startNoteNum = 47;
const musicKeys = [
  '`',
  '1',
  '2',
  'q',
  'w',
  'a',
  'z',
  'x',
  's',
  'd',
  'e',
  'r',
  '4',
  '5',
  '6',
  't',
  'y',
  'g',
  'b',
  'n',
  'h',
  'j',
  'u',
  'i',
  '8',
  '9',
  '0',
  'o',
  'p',
  'l',
  '.',
  '/',
  ';',
  "'",
  '[',
  ']',
  '=',
  'Backspace',
];

export const keyToNoteNum = {};
musicKeys.forEach((key, idx) => {
  keyToNoteNum[key] = startNoteNum + idx;
});
