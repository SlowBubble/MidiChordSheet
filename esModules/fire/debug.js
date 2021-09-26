const VERSION = '0-0';

export function isDebug() {
  return (new URL(document.URL)).origin.includes('localhost');
}

export function version() {
  if (isDebug()) {
    return 'song-debug';
  }
  return 'song-' + VERSION;
}
