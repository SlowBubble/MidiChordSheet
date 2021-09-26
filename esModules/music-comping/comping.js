import { genRhythms } from "./rhythm.js";
import { addNotesToRhythms } from "./voicing.js";

export function genComping(songParts) {
  const rhythms = songParts.map(part => genRhythms(part));
  return addNotesToRhythms(rhythms, songParts);
}