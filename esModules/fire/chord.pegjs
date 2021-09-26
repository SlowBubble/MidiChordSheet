
{
  function makeChord(r, q, e, sus, alts, b) {
    sus = sus || null;
    if (sus === 'sus2') {
      sus = 2;
    } else if (sus === 'sus4' || sus === 'sus') {
      sus = 4;
    }
    return {
      root: r,
      quality: q,
      extension: e,
      suspension: sus,
      alterations: alts,
      bass: b
    };
  }
  function makeAlt(acc, ext) {
    return {
      extension: ext,
      isSharp: acc === '#',
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

start = r:root q:quality? eq:extensionQuality? e:extension? sus:suspension? alts:alter* b:bass? {
  q = q == 'min' ? 'm' : q;
  q = q == 'M' ? 'maj' : q;
  if (eq) {
    if (q != 'm') {
      error('Altering 7th to major is only supported for a minor chord.');
    }
    q = 'mM';
  }
  return makeChord(r, q, e, sus, alts, b);
}

bass = "/" bassNote:note { return bassNote; }

quality = "M" / "maj" / "m" / "min" / "dim" / "aug"

// This is needed because quality cannot support both "m" and "mM".
extensionQuality = [mM]

suspension = "sus4" / "sus2" / "sus"

extension = digits:[0-9]+ { return makeInteger(digits); }

alter = a:accidental e:extension { return makeAlt(a, e); }

root = n:note

note = l:letter accs:accidental* { return {letter: l, numSharps: countSharps(accs)}; }

letter = char:[a-gA-G] { return  char.toUpperCase(); }

accidental = [#b]
