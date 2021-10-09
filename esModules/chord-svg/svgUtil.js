
const w3 = 'http://www.w3.org/2000/svg';

export function makeSvgElt(tag, attrs, innerHTML) {
  const elt = document.createElementNS(w3, tag);
  for (var p in attrs) {
    elt.setAttributeNS(null, p, attrs[p]);
  }
  if (innerHTML) {
    elt.innerHTML = innerHTML;
  }
  return elt;
}

export function getBoundingBox(textInput, style) {
  const svg = document.createElementNS(w3, "svg");
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  const text = document.createElementNS(w3, 'text');
  textInput.split('\n').forEach(line => {
    const tspan = document.createElementNS(w3, 'tspan');
    tspan.textContent = line;
    text.appendChild(tspan);
  });
  Object.keys(style).forEach(key => {
    text.setAttribute(key, style[key]);
  });
  svg.appendChild(text);
  document.body.appendChild(svg);
  const box = text.getBBox();
  svg.remove();
  return box;
}