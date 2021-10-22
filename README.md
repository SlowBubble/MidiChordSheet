# Goal

Generate a backing track from data in a spreadsheet of chords.

# Features

## WIP

- Think about how to restore the nice switch of instruments.
  - Chosen: Assume channel instrument are fixed
    - Assign multiple channels per voice (may be 3?).
    - Switch channel when part changes.
  - Discarded: Change channel instrument for a voice halfway thru?
- Playlist
  - Use a group of checkboxes to indicate what's being randomized and not (e.g. when a user initiates a key change)
  - X: # of repeats
  - randomize transpose (must take min-max melody into account because high pitch is really annoying.)
  - randomize instrument
  - tempo multiplier

## P1

- Is this still an issue? Fix beat subdivision 1 delay in playing
- Comping same chord across measures.
- Comping for 2/4 is too monotonous.
  - May be use some 4/4 comping style, except that the bass notes follow 2/4 comping.
- Syncopate into 4n of the previous bar if syncopationPct > something.
- Show 1 voice for the lead sheet view (add another view or debug view).
- Display k, k-1, ....
  - Need more design for what info is needed and how to convert.
- pickup measure for chords.
  - Need to use v2 for chord parsing.
- Display a chord at the start of a measure even if it did not change from the last measure.
- Fix color notes clustering
  - need a way to identify what needs to not be on the bottom.
- Deal with 3/4 comping separately
  - Current bandaid is to do 1 long chord.
  - x | _ x | x is nice too.


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

- Rewind/Fast-forward (1 measure) button.
  - Shortcut: left, right
- Comping for subdivision 3 (and 1?).

## Done

- Design LyricsDisplayer.
  - SongReplayer needs to publish the curr time whenever a new note with a new time is played.
- v1 LyricsDisplayer: Show solfege for sing-along.
- Non-final turn-around via parens. E.g. (Dm7 G7).
- Melody
  - Do slots; - _ means -.
  - Currently, melody once (in the future, more options).
- Key change
  - Does that mean we should deprecate this in ChordSheet?
  - ChordSheet should still do formatting though.
- 3-note comping generator
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

## midi-sheet non-features (i.e. ChordSheet features)

- Data won't be saved, but customization will be stored in the URL params.