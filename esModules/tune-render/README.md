
- Given a music-tune Tune object, returns a list of SVGElement.
  - The list makes it easier for the caller to make rendering optimization.
- Can be configured with an onClickHandler and the smallest subdivision (Time) so that
  - when the SVG is clicked, the handler is invoked with the Location.

# P0

Focus on just chords

## Design

Location:
- type: LocationType
- (horizontal) musicTime: MusicTime
- (vertical) noteNumber
- voiceIndex: Number

LocationType:
  - has voiceIndex:
    - timeSig, keySig
    - has approx time: noteSpace, chordSpace, lyricsSpace
    - has exact time: note, chord, lyrics, accidental, tempo
  - no voiceIndex: title
