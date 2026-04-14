// recorderDisplay.js — renders recorded notes and beats as pretty JSON

export function init(noteRecorder) {
  const pre = document.getElementById('recorder-display');
  if (!pre) return;

  noteRecorder.subscribe(({ notes, beats }) => {
    pre.textContent = JSON.stringify({ notes, beats }, null, 2);
  });
}
