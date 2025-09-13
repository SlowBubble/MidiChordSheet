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
- Improve the score
  - Call the current score "Nitpicker's score". Call the other score "Connoisseur's score".
  - (easier if I record all the times and compute when the music stops, even partially)
  - 0/1 if the note is not struck near an 8th note
  - 1/1 if the note is struck near an 8th note
  - 0/1 if the first bass is not struck within [-1, 1]
    - Make an exception for bass note that repeat across chord change
  - 0/1 if the first RH note is not struck within [-1, 2]

## Done
- Add score history in console log.
- Remove things from the sheet music (renderMgr) as the song goes by looking at the time. 

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
