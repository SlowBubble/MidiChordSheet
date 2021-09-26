
const undoStack = [];
const redoStack = [];
let currState = null;

export function record(serializable) {
  const currState2 = serializable.serialize();
  if (currState2 === currState) {
    return;
  }
  // Store non-null currState only.
  if (currState) {
    undoStack.push(currState);
  }
  currState = currState2;
  while (redoStack.length > 0) {
    redoStack.pop();
  }
}

export function undo() {
  if (undoStack.length < 1) {
    return;
  }
  redoStack.push(currState);
  currState = undoStack.pop();
  return deserialize(currState);
}

export function redo() {
  if (redoStack.length < 1) {
    return;
  }
  undoStack.push(currState);
  currState = redoStack.pop();
  return deserialize(currState);
}

function deserialize(res) {
  return JSON.parse(res);
}