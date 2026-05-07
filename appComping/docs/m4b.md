# m4b: Disable Beat Triggering During Replay

## Implementation

Prevents beat triggering and note recording during replay mode to avoid interference with the replay playback.

### Problem

When replaying a recorded session, any MIDI input (keyboard or physical MIDI) would:
- Trigger the measure timing detection logic
- Start recording new notes
- Potentially start a new drum pattern
- Interfere with the replay playback

### Solution

Added a replay mode flag that disables all recording and beat triggering functionality during replay.

### Changes

**beatStateMgr.js**:
- Added `_isInReplayMode` private flag to track replay state
- Added `setReplayMode(v)` function to set the replay mode flag (called by replay.js)
- Added `isInReplayMode()` function to query the replay mode state
- Modified `handleMeasureTiming()`:
  - Returns early if `_isInReplayMode` is true
  - Prevents low note triggers from starting beat patterns during replay
- Modified `onNoteEvent()`:
  - Returns early if `_isInReplayMode` is true
  - Still plays sound for keyboard input during replay (for user feedback)
  - Skips all recording and beat triggering logic
- Modified `startManualBeat()`:
  - Returns early if `_isInReplayMode` is true
  - Prevents Enter key from starting beats during replay

**replay.js**:
- Imported `setReplayMode` from beatStateMgr
- Calls `setReplayMode(true)` in `startReplay()` after setting `_isReplaying = true`
- Calls `setReplayMode(false)` in `stopReplay()` after setting `_isReplaying = false`

### Behavior

**During Replay:**
- Low note triggers are ignored (no beat pattern starts)
- Enter key is ignored (no manual beat start)
- MIDI events are not recorded
- Keyboard input still produces sound (for user to play along)
- Physical MIDI input is completely ignored

**Pickup Measure Handling:**
- If there are notes in the pickup measure (before the first recorded beat), replay generates beats only for the pickup duration
- Calculates how many beats are needed to cover from the earliest note to the first recorded beat
- Generates those beats with appropriate beat numbers (e.g., if 2 beats needed in 4/4, generates beats 3 and 4)
- This prevents a long delay with no beats before the pickup starts
- If no pickup notes exist, generates a full measure of beats as before

**After Replay Ends:**
- Replay mode flag is cleared
- All recording and beat triggering functionality is restored
- User can start a new recording or continue an existing one

### Design Notes

The implementation uses a separate flag in `beatStateMgr.js` rather than importing `isReplaying()` from `replay.js` to avoid circular dependency issues (beatStateMgr imports from replay for other functions, and replay imports from beatStateMgr).

The flag is set/cleared by replay.js at the start and end of replay, ensuring the state is always synchronized with the actual replay state.
