# Goal

* Provide a song object that can be used to render sheet music.

# Design

* On click, we will need to output this indentification info to the click listener:
  - For a note click, provide the voices index and the noteGps index.
  - For a chord click, provide the chordChanges index.
  - For a lyrics click, provide the voices index and the lyricsTokens index.

