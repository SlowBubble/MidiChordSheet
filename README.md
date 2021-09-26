# Goal

Generate a backing track from data in Spreadsheet of chords.

# Features

## P0

- A play button to resume/pause the backing track.
  - Shortcut: space.
- A stop button.
  - Shortcut: 0.
- Rewind/Fast-forward (1 measure) button.
  - Shortcut: left, right
- Tempo slider.
  - Shortcut: [, ]
- Key change
  - Does that mean we should deprecate this in ChordSheet?
  - ChordSheet should still do formatting though.
- 3-note comping generator

## P1

- Walking bassline
- Parse comp style from spreadsheet
  - style: bossa
  - style: walking bass
  - style: walking comp
  - style: syncopated


## P2

- Rendering the sheet?
- Customize how many times to repeat the song.
  - Should this be the responsibility of ChordSheet?
  - Need to understand how the parts can stitch together.

## Non-features (i.e. ChordSheet features)

- Data won't be saved, but customization will be stored in the URL params.
- Using non-default scale when composing the comping.

# Design

- The spreadsheet data will be transmited in the URL params.
  - 8kb limit should be plenty for a song.
  - Compress this via a dict?