# m3d — Rolling 8-Measure Window During Recording

## Overview

During live recording, `sheetDisplay.js` renders only the most recent 8 measures instead
of the full accumulated sheet. When the drum pattern stops (idle), the full sheet is
rendered.

## Motivation

Rendering the entire sheet on every measure boundary gets progressively more expensive as
a session grows. Since the player is actively performing, only the current context (the
last few measures) is useful to see. The full sheet is shown once recording stops.

## Implementation

### `noteRecorder.js`

`notify()` gains a second boolean parameter `idleFired` (default `false`). `markIdle()`
now calls `notify(false, true)` so subscribers are notified when the drum pattern stops,
giving them a chance to re-render the full sheet.

### `beatStateMgr.js`

Exports `isDrumRunning()` so `sheetDisplay.js` can check whether recording is active
without creating a circular dependency.

### `sheetDisplay.js`

**Constant:** `RECORDING_WINDOW_MEASURES = 8`

**`buildAndRender`** gains a `windowStart8n` parameter (a `Frac` or `null`). It is passed
straight through to `renderMgr.render(song, false, windowStart8n, cursorTime8n)`.
`render.js` already supports `sheetStart8n` windowing — it filters note groups to the
window and handles partial notes at the boundary.

**Subscriber logic:**

```
idleFired  → buildAndRender(notes, beats, null, null)   // full sheet, no window
beatFired  → throttle to beat 1 per measure (m3c), then compute windowStart8n
note event → compute windowStart8n and render immediately
```

**Window calculation** (when `isDrumRunning()` is true):

```
currentMeasureIdx     = floor((lastBeatTime - measure1StartMs) / measureDurMs)
latestStart           = max(0, currentMeasureIdx - RECORDING_WINDOW_MEASURES + 1)
windowStartMeasureIdx = floor(latestStart / 4) * 4
windowStart8n         = windowStartMeasureIdx * beatsPerMeasure * 2   (in eighth-notes)
recordingSheetEnd8n   = currentMeasureIdx * beatsPerMeasure * 2       (hides current measure)
```

The window start snaps to multiples of 4, but only advances when the current measure
would overflow the second line (i.e. `currentMeasureIdx >= windowStart + 8`). New measures
always appear on the second line until it fills up, then the window jumps forward by 4:
0–7, 4–11, 8–15, 12–19, …

`windowStart8n` is stored as `_lastWindowStart8n` and reused in `renderWithCursor` so the
replay cursor offset stays consistent with whatever window was last rendered.

## Behaviour

| State | Window |
|---|---|
| Drums running (recording) | Last 8 measures |
| Drums stopped (idle) | Full sheet |
| Viewing saved recording | Full sheet (drums never run) |
| Replay cursor | Uses same window as last render |

## Notes

- The `Song` object is always built from all recorded notes. Windowing is purely a
  render-time concern — `_lastSong` and `_lastGrid` remain complete for replay use.
- The window start snaps to multiples of 4, giving a half-window overlap: 0–7, 4–11,
  8–15, 12–19, … — flipping every 4 measures.
- `render.js` suppresses the pickup when `sheetStart8n` is non-null, which is correct
  since the pickup only applies at the very beginning of the piece.
