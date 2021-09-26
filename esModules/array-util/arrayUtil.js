export function range(start, end, step) {
  step = step || 1;
  const res = [];
  for (let i = start; i < end; i += step) {
    res.push(i);
  }
  return res;
}

export function chunkArray(arr, isNextChunkFunc) {
  const res = [];
  let currChunk = [];
  arr.forEach(item => {
    if (isNextChunkFunc(item)) {
      if (currChunk.length > 0) {
        res.push(currChunk);
      }
      currChunk = [item];
      return;
    }
    currChunk.push(item)
  });
  if (currChunk.length > 0) {
    res.push(currChunk);
  }
  return res;
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// arr[0] will be the key and arr[1] will be the val.
export function arrayToObject(arr) {
  const obj = {};
  arr.forEach(item => {
    obj[item[0]] = item[1];
  });
  return obj;
}