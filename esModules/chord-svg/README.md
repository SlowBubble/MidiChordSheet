
- Given a SongForm object, returns a list of SVGElement displaying the chords
  - The list makes it easier for the caller to make rendering optimization.

# Requirements

## P0

- Render static SVG.
- ♭♯♮
- Explicit: maj, m, dim, aug, sus

## P1
- Support animation while playing by highlighting the latest chord whose time8n is leq currTime8n.
  - Have the caller set the currTime8n
  - Have logic to decide whether re-rendering is necessary; if not, return null.
- Support propagating click events on a chord.
  - The caller will have a handler to use the event's time8n to update currTime8n everywhere.

## P2

- Use 3x, 2x, 1x to show the progress of repeats.
  - Future: reduce duplication as much as possible using ----1, ----2.

## P3

- If not enough space, switch to abbreviated names Δ7, -7, ø7, °7, +.

## Future Design

- Can be configured with an onClickHandler and the smallest subdivision (Time) so that
  - when the SVG is clicked, the handler is invoked with the Location.
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
