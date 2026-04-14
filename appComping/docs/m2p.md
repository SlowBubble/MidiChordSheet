# m2p — Sheet Alignment Bug Fix

## Problem

The first left-hand note was not appearing at beat 1 of measure 1 on the sheet, even though it was played exactly on the measure trigger.

## Root Causes

### 1. Drum grid not anchored to measure start

`playDrumPattern` was setting `nextFireTime = performance.now()` — the moment the second trigger note was processed — rather than anchoring to `lowNoteList[0].time` (the first trigger note, which by definition is beat 1 of measure 1).

This meant `beats[0].time` (the first recorded drum beat) was off by the processing delay, and `sheetDisplay` was extrapolating `measure1StartMs = beats[0].time - measureDurMs` from that already-wrong value.

**Fix:** `measure1StartMs = lowNoteList[0].time` is now passed into `playDrumPattern`. The drum loop converts it to `performance.now()` domain and schedules beat 1 of measure 2 at exactly `measure1StartMs + measureDurMs`. `measure1StartMs` is stored in `noteRecorder` and read directly by `sheetDisplay`.

### 2. Absolute slot indices used as relative 8n positions

`slotMapToNoteGps` was computing note positions as `makeFrac(slotIdx, 2)` where `slotIdx` was an absolute index from `grid[0]`. But `grid[0]` is the start of the pickup region (or earlier), not beat 1 of measure 1. This created a phantom leading rest equal to `measure1Slot0` slots, pushing every note to the right.

**Fix:** `slotMapToNoteGps` now takes a `startSlot` parameter and computes positions as `makeFrac(slotIdx - startSlot, 2)`, so beat 1 of measure 1 always maps to 8n = 0.

## Time Domain Note

`evt.time` uses `Date.now()` (epoch ms). `performance.now()` is used for the RAF drum loop. The conversion `perfToDateOffset = Date.now() - performance.now()` bridges the two domains when scheduling drum beats.
