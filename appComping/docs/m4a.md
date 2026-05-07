# m4a: Manual BPM Start

## Implementation

Added an alternative way to start the beat and recording using the Enter key, with configurable BPM.

### Features

1. **Enter Key Start**: Press Enter to immediately start the beat at the configured BPM (default 75)
   - **First press**: Starts fresh recording with drum pattern starting as pickup measure
   - **Subsequent presses**: Continues recording (append mode)
     - Stops current drum pattern
     - Trims the last measure from recording (to be overwritten by new pickup)
     - Starts new drum pattern immediately as pickup for next section
   - Allows continuous recording with multiple sections
   - **Drum pattern starts as pickup**: The first measure of drum beats is treated as the pickup measure, so the sheet music shows "measure 1" starting after the first full measure of beats

2. **BPM Configuration via Buttons**: 
   - Added "Manual BPM (Enter)" row in the menu
   - Up/Down buttons increment/decrement by 5 BPM
   - Minimum BPM: 5
   - Default: 75 BPM

3. **BPM Configuration via Backslash Key**:
   - Press `\` key consecutively (within 1 second) to increment BPM by 5
   - Provides quick keyboard-only BPM adjustment

### Changes

**beatStateMgr.js**:
- Added `manualBpm` state variable (default 75)
- Added `setManualBpm()` function
- Modified `playDrumPattern()` to accept optional `startImmediately` parameter:
  - When `true`, drum pattern starts immediately at current time (for manual start)
  - When `false` (default), maintains existing behavior (starts at measure 2)
- Added `startManualBeat()` function that:
  - **First call**: Calculates measure duration from BPM, sets measure1StartMs to `now + dur`, starts drum pattern immediately
  - **Subsequent calls**: Stops drum, trims last measure, updates measure1StartMs to continue from current position, restarts drum
  - Updates noteRecorder with timing info

**noteRecorder.js**:
- Added `trimLastMeasure()` function that:
  - Finds measure boundaries by detecting beat 1 transitions
  - Removes all beats and notes from the last complete measure
  - Clears open notes
  - Used when Enter is pressed again to allow pickup to overwrite last measure

**buttons.js**:
- Imported `manualBpm` and `setManualBpm`
- Added `updateManualBpmDisplay()` function
- Wired up increment/decrement buttons for manual BPM (±5 BPM per click)

**keyboardHandler.js**:
- Imported `startManualBeat`, `manualBpm`, `setManualBpm`
- Added Enter key handler to call `startManualBeat()` immediately (no MIDI ready wait)
- Added Backslash key handler with consecutive press detection:
  - Tracks last press time
  - If pressed within 1 second of previous press, increments BPM by 5
  - Updates display

**index.html**:
- Added "Manual BPM (Enter)" row with display and up/down buttons
- Positioned after "Idle measures to stop" and before "Note Start Quanta"

### Usage

1. **Quick Start**: Press Enter to start beat at 75 BPM (or configured BPM)
   - Drum pattern starts immediately
   - First measure of beats is the pickup measure
   - Sheet music shows "measure 1" starting after the first full measure
2. **Continue Recording**: Press Enter again while recording
   - Last measure is trimmed
   - New pickup measure starts immediately
   - Recording continues seamlessly
3. **Adjust BPM**: Use ▲/▼ buttons or press `\` repeatedly
4. **Stop/Reset**: Press Space to fully reset
