# m2r — RecordingId Rendering Fix + Title Display

## Problems

### 1. `loadInto` called with stale signature

`compingMain.js` was calling `loadInto` with the old 6-argument signature, missing `noteStartDenom` and `measure1StartMs` added in m2o/m2p. This meant saved recordings rendered without proper grid alignment.

**Fix:** Updated the call to pass all fields: `rec.noteStartDenom`, `rec.measure1StartMs`, and `rec.label`.

### 2. Missing `measure1StartMs` fallback for old recordings

Recordings saved before m2p don't have `measure1StartMs` in localStorage. Without it, `sheetDisplay` bails out and renders nothing.

**Fix:** `loadInto` derives a fallback: `beats[0].time - measureDurMs` — the original extrapolation method — when `savedMeasure1StartMs` is absent.

### 3. Recording title not shown on sheet

The saved label was only shown in the status bar (`📼 My Recording`), not in the sheet music itself. `RenderMgr` already calls `stateMgr.setTitle(song.title)`, so the plumbing was there.

**Fix:** `label` is stored in `noteRecorder` via `setLabel`/`getLabel`, loaded via `loadInto`, and passed as `title` to the `Song` constructor in `sheetDisplay`. Live recordings (no label) fall back to the `Song` default (pretty date string).
