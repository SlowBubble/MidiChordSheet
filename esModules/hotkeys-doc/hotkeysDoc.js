
export const keyToShortcutMapping = {};

export function hotkeysDoc(shortcut, handler) {
  hotkeys(shortcut, evt => {
    evt.preventDefault();
    handler(evt);
  });
  keyToShortcutMapping[shortcut] = summarizeFunctionBody(handler);
}

function summarizeFunctionBody(func) {
  const funcStr = func.toString();
  const lastIdx = funcStr.lastIndexOf(')') + 1;
  if (lastIdx == -1) {
    lastIdx = funcStr.length;
  }
  return funcStr.slice(funcStr.indexOf('.') + 1, lastIdx);
}
function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

function isCros() {
  return /\bCrOS\b/.test(navigator.userAgent);
}

function cmdKey() {
  if (isMac()) {
    return 'metaKey';
  }
  return 'ctrlKey';
}

function cmdKeyString() {
  if (isMac()) {
    return 'command';
  }
  return 'ctrl';
}