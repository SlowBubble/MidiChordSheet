
{
  function makeChord(r, q, ext, sus, alts, b) {
    sus = sus || null;
    if (sus === 'sus2') {
      sus = 2;
    } else if (sus === 'sus4' || sus === 'sus') {
      sus = 4;
    }
    return {
      root: r,
      quality: q,
      extension: ext,
      suspension: sus,
      alterations: alts,
      bass: b
    };
  }
  function makeExt(extNum, major7) {
    return {
      extensionNum: extNum,
      isMajor7: major7 == 'M',
    };
  }
  function makeAlt(extNum, acc) {
    let numSharps = 0;
    if (acc == '#') { numSharps = 1; }
    if (acc == 'b') { numSharps = -1; }
    return {
      extensionNum: extNum,
      numSharps: numSharps,
    };
  }
  function makeInteger(o) {
    return parseInt(o.join(""), 10);
  }
  function countSharps(accs) {
    let count = 0;
    accs.forEach(acc => {
      if (acc === '#') {
        count++;
      } else {
        count--;
      }
    });
    return count;
  }
}

start = r:root q:quality? e:extension? sus:suspension? alts:alteration* b:bass? {
  return makeChord(r, q, e, sus, alts, b);
}

bass = "/" bassNote:note { return bassNote; }

// null means major
quality = "m" / "dim" / "aug"

// We cannot support "maj" because the "m" is greedily swallowed by quality.
// Because of this, we will need to convert maj to M during pre-processing.
major7 = "M"

extension = m:major7? jen:jazzExtensionNum { return makeExt(parseInt(jen), m); }

suspension = "sus4" / "sus2" / "sus"

extensionNum = digits:[0-9]+ { return makeInteger(digits); }

jazzExtensionNum = "7" / "9" / "11" / "13"

alteration = ap:alterationPrefix? en:extensionNum { return makeAlt(en, ap); }

root = n:note

note = l:letter accs:accidental* { return {letter: l, numSharps: countSharps(accs)}; }

letter = char:[a-gA-G] { return  char.toUpperCase(); }

alterationPrefix = accidental / "/" / "add"

accidental = "#" / "b"