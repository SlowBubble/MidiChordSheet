
# Goal

* Provide data structures to describe a chord and the spelling of a musical note.
* Provide functions to choose between enharmonic spellings:
  - Currently, this is only based on the underlying chord quality.

# Non-goal

* Won't infer spelling of the root of a chord
  - This requires knowing the chord progrssion that the chord is in.

# TODO

* Wrap chordParser.js into a ES6 module.

## Take into account the preceding following note when inferring enharmonic spellings of a note
- a: chord tones are 1, 3, 5, 7, 9, 11, 13 of the chord.
- b: b9 trumps #1, #9 trumps b3, #11 trumps b5, b13 trumps #5, M7 trumps b1, m7 trumps #13
- Exception 1: if a note starts later than a beat before the next chord and extend into the next chord, we will spell it using the next chord tone.
  + we may need to use the original chord if the next chord tones does not include the note.
- Exception 2: if the note in case b is less than a beat and followed by a note within a semi-tone, use different spellings:
  + In Fmaj7: A-G#-A-C-E-D vs A-Ab-G-E-A-C-D.