# m2s — Replay Drums + Volume Stacking Bug Fix

## Drum playback during replay

Replay now fires the same drum pattern that was used during recording, not just the beat display circles. `scheduleReplayDrums` in `beatStateMgr.js` generates the MIDI pattern (same time signature + subdivision) and schedules each hit via `setTimeout`, anchored to `measure1StartMs`. The beat display updates in sync. `beatSubdivision` is now persisted in saved recordings so replays use the correct pattern.

## Volume stacking bug

Piano notes were getting progressively louder with each keypress after audio loaded. The cause: `keyboardEvtSub(evt => onNoteEvent(evt, true))` was inside the `initMidi` callback, which fires on every keydown once MIDI is ready. This added a new subscriber on each keypress — by the 5th note, 5 simultaneous piano voices were playing.

Fixed by guarding the subscription with a `keyboardSubscribed` flag so it only registers once.
