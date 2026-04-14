# Spec: m2d — Record Comped Notes and Beats

## Goal
Record what has been comped (notes played and beats) and display them live as pretty JSON.

## Requirements

### noteRecorder.js
1. Record every NoteOn/NoteOff event that passes through `onNoteEvent`.
2. When the beatStateMgr transitions from active → idle (drum stops due to idle timeout or reset), clear all events recorded before that idle transition — i.e. only keep events from the current active session.
3. Record beats: each time a drum beat fires, record `{ beat, time }`.
4. Expose:
   - `recordNote(evt)` — called with a midi event
   - `recordBeat(beat, time)` — called when a drum beat fires
   - `clearBeforeIdle()` — clears notes/beats accumulated before the idle point (called on idle/reset)
   - `getNotes()` — returns current notes array
   - `getBeats()` — returns current beats array

### recorderDisplay.js
1. On every note or beat recorded, re-render a `<pre>` element in the page with pretty-printed JSON of `{ notes, beats }`.
2. Expose `init(noteRecorder)` — sets up the display element and subscribes to updates.

## Wiring (compingMain.js)
- Import and init both modules.
- Pass `recordNote` into `beatStateMgr.onNoteEvent` flow.
- Pass `recordBeat` into the drum tick loop.
- Call `clearBeforeIdle()` on idle timeout and reset.

## Implementation Tasks
- [ ] Create `appComping/noteRecorder.js`
- [ ] Create `appComping/recorderDisplay.js`
- [ ] Update `appComping/beatStateMgr.js` to call `recordBeat` on each beat tick and `clearBeforeIdle` on idle/reset
- [ ] Update `appComping/compingMain.js` to wire up recorder and display
- [ ] Update `appComping/index.html` to add the display `<pre>` element
