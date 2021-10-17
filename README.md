# Goal

Generate a backing track from data in a spreadsheet of chords.

# Features

## WIP

- Design auto-playing playlist
  - Use ajax to fetch tsv data from a server without page refresh (because MIDI.js must be user triggered).
  - Customize # of repeats, randomize transpose (take min-max melody into account), randomize instrument, tempo multiplier.

## P1

- Comping same chord across measures.
- Display k, k-1, ....
  - Need more design for what info is needed and how to convert.
- pickup measure for chords.
  - Need to use v2 for chord parsing.
- Display a chord at the start of a measure even if it did not change from the last measure.
- Fix color notes clustering
  - need a way to identify what needs to not be on the bottom.
- Deal with 3/4 comping separately
  - Current bandaid is to do 1 long chord.
- Comping for 2/4 is too monotonous.

## P2

- Record backing track for youtube?
- Think about song form e.g. (a-b)-a-b'
  - Should nonrepeating final parts, a-b', be inferred from a, b, outro using the header, "Replace: b"?
  - Should we allow parenthens in last chords to denote turn-around variation e.g. "C (_ _ G7)"
- Control comping volume pct.
- When to leave space and when not to for a 2-bar static chord?
  - use densityFactor similar to syncopation.
- Comp style
  - style: bossa
  - style: walking
- Toggle swing: Straight, light, medium, hard.
- Bug: padLeft is too much when subdivision is 1.

## P3

- A playlist of jazz standards.
- A playlist of jazz standards with melody.
  - The comping may need to be different (less dense and syncopated).
  - Need to design how to store melody in sheets (inline with chords or in its own block?)
    - For block, we will need to specify voice: melody (and for named chord part, part: ${matching_chord_part}).
    - Block may be easier to copy-paste data back into a spreadsheet.
    - https://stackoverflow.com/a/60698329
- A stop button.
  - Shortcut: 0.
- Rewind/Fast-forward (1 measure) button.
  - Shortcut: left, right
- Comping for subdivision 3 (and 1?).

## Done

- Non-final turn-around via parens. E.g. (Dm7 G7).
- Melody
  - Do slots; - _ means -.
  - Currently, melody once (in the future, more options).
- Rendering only the chords.
- A play button to resume/pause the backing track.
  - Shortcut: space.
- Tempo.
  - Shortcut
- Key change
  - Does that mean we should deprecate this in ChordSheet?
  - ChordSheet should still do formatting though.
- 3-note comping generator
- Customize how many times to repeat the song.
- data param in the url will go at the end.
- Shortcut to control off-beat.
- drum start a bar early, stop a bar early.
- Menu
  - Have actionMgr update the values.
- Drum beat sub-division
  - Customize for 1, 2, 3, 4
  - Should we be controlling this via lower numeral instead, since it will affect comping?

### ChordSheet client

- Shade all header cell to be grey.
- Upsert "Backing Track" cell.
  - For insert, use the upper right corner (zeroTimeRowIdx, finalColIdx).
  - Remove this cell from the data param.
- Clear the whole sheet before writing to it.
- Does active range always start at absolute idx 1, 1? Yes.
- Compute zeroTimeColIdx and zeroTimeRowIdx.
- If no key header, insert (Key: C) at zeroTimeRowIdx - 1.
  - If zeroTimeRowIdx - 1 < 0 || (zeroTimeRowIdx - 1, 1) is non-empty, prepend a row.
- If no meter header, insert (meter: 4/4).

## Non-features (i.e. ChordSheet features)

- Data won't be saved, but customization will be stored in the URL params.
- Using non-default scale when composing the comping.

# Design

- The spreadsheet data will be transmited in the URL params.
  - 8kb limit should be plenty for a song.
  - Compress this via a dict?