
export function mod(x, y) {
  return ((x % y) + y) % y;
}

export function gcd(x, y) {
  x = Math.abs(x);
  y = Math.abs(y);
  while(y) {
    var t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export function isPowerOf2(v) {
  return v && !(v & (v - 1));
}

export function range(start, end, step) {
  step = step || 1;
  const res = [];
  for (let i = start; i < end; i += step) {
    res.push(i);
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