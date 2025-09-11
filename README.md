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

Smart mode will move the indexes smartly between key down and note on
- First, chunk the noteGps for each hand by chord change
- On key down for a hand, before creating a NoteOn event
  - If chunkFinished (i.e. all the noteGps for that hand has played)
    - If currTime > nextChordChangeTime - (1/8 + 1/16), update the index to the next chunk and set chunkFinished to false.
  - Else
    - If currTime > nextChordChangeTime - (1/16), update the index to the next chunk and set chunkFinished to false.
  - Then create the NoteOn event
  - Then increment the index (but looping within the chunk) and set chunkFinished to true if completing the loop.


## TODO
- Freeze the current arrangement
- Add different arrangement styles
- How to fix legacy melody format?

## Style design

### Melody-independent

### Melody-dependent
