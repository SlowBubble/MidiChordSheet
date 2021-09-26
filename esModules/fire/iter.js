
export function forEachWithBreak(arr, action) {
  let breakCondition = false;
  function breakFunc() {
    breakCondition = true;
  }
  for (let i = 0; i < arr.length; i++) {
    if (breakCondition) {
      return;
    }
    action(breakFunc, arr[i], i);
  }
}

export function boundedWhile(action, max_iter) {
  let breakCondition = false;
  function breakFunc() {
    breakCondition = true;
  }
  let idx = 0;
  while (!breakCondition) {
    if (idx > max_iter) {
      break;
    }
    action(breakFunc, idx);
    idx++;
  }
}