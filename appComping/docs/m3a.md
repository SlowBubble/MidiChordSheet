# m3a — Grace Note Detection & Rendering

## Overview

Grace notes are detected in `sheetDisplay.js` inside `classifyGraceNotes()`, which is called
per-voice (RH and LH separately) before the slot-map is built.

## Detection conditions

A note is classified as a grace note if **both** of the following hold relative to the
immediately following individual note:

| Condition | Threshold | Meaning |
|---|---|---|
| `next.onTime - note.onTime` | < 135 ms | The next note started within 135 ms of this one starting |
| `next.onTime - note.offTime` | < 75 ms | The next note started within 75 ms of this one ending (negative = overlap, which is fine) |

Constants in code: `GRACE_START_TO_START_MS = 135`, `GRACE_END_TO_START_MS = 75`.

## Key subtleties

### 1. Detection happens before chord grouping

The normal rendering pipeline groups notes that start within 60 ms of each other into a
chord. A grace note played right before the next note can easily fall inside that 60 ms
window and get merged into the same chord, making it invisible to any duration-based check.

**Fix:** `classifyGraceNotes` runs on the raw sorted individual notes first. Only after
grace notes are identified are the remaining (regular) notes grouped into chords.

### 2. Per-voice classification

Grace detection runs separately on RH notes (above the low-note threshold) and LH notes
(at or below it). Running it on all notes together caused bass trigger notes to be grouped
with treble grace notes, inflating the apparent duration and preventing detection.

### 3. Negative end-to-start gap is intentional

When a player holds a grace note slightly into the next note (overlap), `next.onTime -
note.offTime` is negative. This is normal technique and should still qualify. The threshold
`< 55 ms` naturally allows negative values.

## Rendering

Detected grace notes are passed to `slotMapToNoteGps()` as `graceGroups` — an array of
`{ slotIdx, noteNums[] }`. Just before the real note at `slotIdx` is emitted, a
`QuantizedNoteGp` with `start8n === end8n` is inserted for each grace chord. The
downstream ABC renderer (`state.js`) recognises zero-duration note groups as grace notes
and wraps them in `{...}` braces in the ABC string, which ABCJS renders as grace notes.

## Consecutive grace notes

Multiple consecutive notes can all qualify as grace notes (each one checked against the
note immediately after it). They accumulate in `pendingGrace` and are all attached to the
first following non-grace note, appearing as a run of grace notes before it on the sheet.
