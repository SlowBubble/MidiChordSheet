
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

