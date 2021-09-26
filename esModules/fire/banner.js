/**
 * @fileoverview Description of this file.
 */


const html = `
<style>
#banner {
    position: fixed;
    top: 0;
    left: 50%;

    background-color: #f9edbe;
    border-color: #f0c36d;
    border-style: solid;
    border-width: 1px;
    padding: 6px;
    font-size: 20px;

    visibility: hidden;
}
</style>
<div id='banner'>
</div>
`;

export class EphemeralBanner extends HTMLElement {
  constructor() {
    super();
    this.root = null;
    this.timeout = null;
  }

  connectedCallback() {
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = html;
  }

  display(message, color, period) {
    color = color || '#f9edbe';
    period = period || 2 * 1000;
    if (!this.root) {
      return;
    }
    window.clearTimeout(this.timeout);
    const banner = this.root.querySelector('#banner');
    banner.textContent = message;
    banner.style.visibility = 'visible';
    banner.style.backgroundColor = color;
    this.timeout = window.setTimeout(() => {
      banner.style.visibility = 'hidden';
    }, period);
  }

  slowDisplay(message) {
    this.display(message, null, 6 * 1000);
  }
}

customElements.define('eph-banner', EphemeralBanner);
