# Goal

Generate a backing track from data in a spreadsheet of chords.

[Demo](https://slowbubble.github.io/MidiChordSheet/)

# Getting started

Currently, the best way to create the spreadsheet is by using the Chord Sheet add-on in Google Sheets™.

[Doc](https://github.com/voice-memo/ChordSheet/blob/main/docs/README.md)

# Spec

## Headers

Headers can be placed on top of a chord to specify changes to the music.

Main:
- Key
- Meter
- Swing
- Tempo

Structure:
- Part
- Copy
- Repeat

Comping:
- Syncopation
- Subdivision

Others:
- Transpose

## Example

- Specify "Key: D" to specify that the song is in the key of D.
- Specify "Meter: 3/4" to specify that the song is has 3 quarter notes in each measure.
- Specify "Swing: Medium" to specify that the song has a medium (triplet) swing feel.

# Work in progress
## Doing

- Remove things from the sheet music (renderMgr) as the song goes by looking at the time. 
- Scoring

## Done
- Removed solfege lyrics by default (obstructing the game)

## TODO
- Smart mode issue
  - TODO for swing ratio 2, need to multiply via 0.5 * 2/3 = 0.33
  - TODO for swing ratio 2, need to multiply via 1 * 2/3 + 0.2 * 4/3 = 0.933
- Freeze the current arrangement
- Add different arrangement styles
- How to fix legacy melody format?

## Style design

### Melody-independent

### Melody-dependent
