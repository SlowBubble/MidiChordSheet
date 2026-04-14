# Goal
- Build a web app within this folder that helps user practice comping

# Project structure
- ../lib and ../esModules have tools that can be shared with other apps


# m2n
- skip displaying the measures at the end if it is entirely a rest measure.

# m2m
the cursor seems to be display at the wrong place on replay when there is a pickup measure

# m2l
- Have the top message (e.g. `1st Measure Trigger`) be in the top of the right menu
- Have the balls use fixed position to the upper left (and have no text instead of '_' when idle)


# m2k

- Pickup measure is implemented incorrectly (currently, all the notes in the pickup are squished into the first measure's start)
  - You should consider the start of the drum beat as the second measure
  - The extrapolated window should be treated as first measure and potentially has an extra pickup measure.
    - Does it have a pickup measure? It's only if the extrapolated is longer than a measure's time should the rest overflow into the pickup 


# m2i
- cmd+s shortcut: save that recording in localStorage
  - Add another saved.html to display what is saved and link it back to index.html with a RecordingId in the hash params to load and display it in index.html.
    - When displaying with RecordingId, don't overwrite the recorder's data (disabling).

# m2h
- The ball display is incorrect when replay, let's just remove that part
- But try to update the cursor of the sheet per beat when replaying

# m2g
- replay.js
  - When you press space while there are recorded notes and the beatStateMgr is idle, replay the notes.

# m2f
- note off qauntize to 1/4 instead of 1/8
  - let's have it be an increment decrement that starts at 1/4 and increase to 1/2 and 1 or decrease by a factor of 2 down
 
# m2e

Study oldApp/ to see how to make the display nicer
- Note the libraries it use, should already be in esModules (see how appPlay/ uses it)
- The hard thing is to decide what goes to the left hand and what goes to the right hand, which oldApp should have logic for.
  - Once that's decided, then the other hard part is to quantize correctly. See if oldApp/ has a good way to do it
  - Feel free to ask me for clarifications if anything is unclear

# m2d
Feature: record what has been comped.

- noteRecorder.js
  - record the notes that have been played so far
    - You will need to clear the notes from before the previous idling of the beatStateMgr (not currently exposed)
  - record the beats
- recorderDisplay.js
  - For now just outputs (notes and beats) in pretty JSON as they are recorded.
  - In the future, we will look at oldApp/ to see how to display these.

# m2c

- compingMain: init and hook things up
- beatStateMgr: handle beat state and trigger things like the sound
- sound: handles the sound
- keyboardHandler
- midiHandler

# m2b
- Change the algo for deciding when measureDurMs can be computed
  - Instead of triggering when another note that has a note number, say N, smaller than the biggest note number in that accumulated list thus far, say [n1, n2, n3, ...] is the distinct ascending note numbers (ded-uplicated), let's trigger when N < n2 (the second note number); there is a special case, when n1 is the first note played and then N < n1, then this should trigger without waiting for 2 note numbers to be accumulated.

# m2a
- In addition having keyboard triggering midi events, listen to actual midi input and trigger midi events.

# wishlist
- Config to only play beat 2 and 4
  - Also other more complex patterns (e.g. subdivision 0)
  - TODO: think of a special drum pattern to trigger by playing double bass near the first beat.

# m1i
- If there are no midi events for 1 whole measure, then stop the drum beats
  - Make this configurable via increase/decrease buttons

# m1h
- Make the note number 60 in m1b to be 64 instead and have it be configurable via buttons in the menu

# m1g
- Try avoding the hacky latency fix of hard-coding drumStartLatency by using requestAnimationFrame instead.
  - with requestAnimationFrame, you should not need setTimout and setInterval at all, since setTimeout is the source of unpredictable delay for the first beat, and also stop using setInterval since it can also have unpredictable delay

# m1f
- Add a button to increase and decrease number of beats per measure (from 4)
- Add another button to increase and decrease the subdivision of the beats.
- Hint: see how appPlay/ does it

# m1e
- There's a lot of latency between measureDurMs and the first beat of the drum
- Compensate by computing the latency and if it is > 0 (which should always be the case), then skip it and just do a setTimeout for the second beat (timeout will depend on the computed latency) or third beat (if even the second beat has latency > 0).

# m1d
- measureDurMs should just be computed once, unless things are reset.
- Use `space` for reset (stop drum beat and clear measureDurMs).


# m1c
- In addition to logging measureDurMs when it is computed, immediately trigger a 4-beat drum track to be played using measureDurMs to determine how fast to play it. The tools should be in musical-beat there may also be usages in appPlay/


# m1b
- When a note on event has note number < 60, add the note number and the timeMs of that event to a list.
  - For the special case when another note that has a note number smaller than the biggest note number in that list, compute the duration between this note's timeMs and the list's first note's timeMs, calling it the measureDurMs
  - Just log measureDurMs for now when it is computed.

# m1a
- Implement a basic piano player using the crooked.js mapping and hooked up with midi js.
  - Don't worry about building any UI.
  - Do everything in appComping/, don't touch anything outside
- Look at examples of how to do it in fire/

