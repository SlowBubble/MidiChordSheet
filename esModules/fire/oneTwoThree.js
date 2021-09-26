
// 53 is F3
const startNoteNum = 53;
const str = `'/;.l,kjnhbgfcdxsza1q2w34r5t6y78i9o0-[=]`;

const musicKeys = str.split('');

export const keyToNoteNum = {};
musicKeys.forEach((key, idx) => {
  keyToNoteNum[key] = startNoteNum + idx;
});