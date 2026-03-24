# Goal
- Build a web app within this folder that helps user practice comping

# Project structure
- ../lib and ../esModules have tools that can be shared with other apps

# m1b
- When a note on event has note number < 60, add the note number and the timeMs of that event to a list.
  - For the special case when another note that has a note number smaller than the biggest note number in that list, compute the duration between this note's timeMs and the list's first note's timeMs, calling it the measureDurMs
  - Just log measureDurMs for now when it is computed.

# m1a
- Implement a basic piano player using the crooked.js mapping and hooked up with midi js.
  - Don't worry about building any UI.
  - Do everything in appComping/, don't touch anything outside
- Look at examples of how to do it in fire/

