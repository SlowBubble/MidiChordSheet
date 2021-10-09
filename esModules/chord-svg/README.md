
- Given a SongForm object, returns a list of SVGElement displaying the chords
  - The list makes it easier for the caller to make rendering optimization.

# Requirements

## Done

- Render static SVG.
- Support highlighting based on currTime8n.
  - Have the caller set the currTime8n.


## P1

- Design how to support animation for both the app and the recorder.
  - For the app, you piece all svgs together into 1 svg.
  - For the recorder, you put 4 lines together and convert to a canvas.
  - How to do re-rendering in a way that is possible for optimization in the future?
- Support propagating click events on a chord.
  - The caller will have a handler to use the event's time8n to update currTime8n everywhere.

## P2

- Use 3x, 2x, 1x to show the progress of repeats.
  - Future: reduce duplication as much as possible using ----1, ----2.

## Design

Option 1: Provide ids of the text elements in the form of chord-svg-${time8n.numer}-${time8n.denom}
Pros: No need to have a mgr with the time8n state.
Cons: Need to design the id carefully to ensure uniqueness.
Cons: Less flexible if we want to add a voice between the lines of chords.

Option 2: Manage the highlighting of selected text element.
Pros: No need to design id naming.
Cons: Manage time8n state.

Q: Should we also manage the rendering of elements into the svg container div?
Pros: Any future optimization won't affect its public interface.
Cons: Adding too much responsibility to it, since we may rely on this optimization for rendering another voice.
A: Yes, making the interface complex is worse. We may need to add layers within the mgr to break up the added responsibility.



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
