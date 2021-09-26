
const idToStart = {};

export function start(id) {
  idToStart[id] = Date.now();
}

export function stop(id) {
  const start = idToStart[id];
  if (!start) {
    return;
  }

  delete idToStart[id];
  const duration = Date.now() - start;
  console.log(`${id}\t`, duration);
}