
const ns = 'http://www.w3.org/2000/svg';

export function makeSvgElt(tag, attrs, innerHTML) {
  const elt = document.createElementNS(ns, tag);
  for (var p in attrs) {
    elt.setAttributeNS(null, p, attrs[p]);
  }
  if (innerHTML) {
    elt.innerHTML = innerHTML;
  }
  return elt;
}
