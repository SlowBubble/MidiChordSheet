/**
 * @fileoverview Description of this file.
 */

const styleImport = `
<link rel="stylesheet" href="diagram-canvas.css">
<link rel="stylesheet" href="diagram-top-right-menu.css">
<link rel="stylesheet" href="diagram-left-menu.css">
<link rel="stylesheet" type="text/css" href="lib/abcjs-midi.css">
`;

const leftPanel = `
<div id='left-panel'>
  <div id='parts-div' class='buttons'>
    <div>Parts</div>
    <div id='parts-list'></div>
    <button id='append-part'>+ part</button>
    <button id='reload-parts'>Reload</button>
    <a id='clone-anchor' style='display: none;'>Cloned From</a>
  </div>
  <div class='buttons'>
    <div>Styling</div>
    <button id='toggle-melody'>Toggle Melody</button>
    <button id='toggle-lyrics'>Toggle Lyrics</button>
  </div>
  <div class='buttons'>
    <div>Key Signature</div>
    <button id='set-key-sig'>Set Key Sig</button>
    <button id='transpose-key'>Transpose</button>
  </div>
  <div class='buttons'>
    <div>Time Signature</div>
    <button id='incr-time-sig'>+ Time Sig</button>
    <button id='decr-time-sig'>- Time Sig</button>
    <button id='incr-time-sig-denom'>+ Time Sig Denom</button>
    <button id='decr-time-sig-denom'>- Time Sig Denom</button>
    <button id='incr-pickup'>+ Pickup</button>
    <button id='decr-pickup'>- Pickup</button>
    <button id='set-tempo'>Tempo</button>
    <button id='toggle-24-44'>2/4 <-> 4/4</button>
    <button id='swingify'>Swingify</button>
    <button id='implicitSwing'>Implicit Swing</button>
  </div>
  <div class='buttons'>
    <div>Edit</div>
    <button id='toggle-show-spelling'>Note Label</button>
    <button id='enharmSpelling'>Edit Note Spelling</button>
    <button id='insert-grace-note'>Grace Note</button>
    <button id='update-lyrics'>Add Lyrics</button>
  </div>
  <div class='buttons'>
    <div>Staff</div>
    <button id='toggle-clef'>Clef</button>
    <button id='add-voice'>+ Staff</button>
    <button id='remove-voice'>- Staff</button>
  </div>
  <div class='buttons'>
    <div>Bass</div>
    <button id='bass-1'>Bass 1</button>
    <button id='bass-2'>Bass 2</button>
    <button id='bossa'>Bossa</button>
  </div>
  <div class='buttons'>
    <div>Accompaniment</div>
    <button id='comping-1'>Comping 1</button>
    <button id='comping-2'>Beat</button>
    <button id='comping-3'>Fingerstyle</button>
    <button id='comping-4'>Comping 4</button>
  </div>
  <div class='buttons'>
    <div>Input</div>
    <button id='incr-keyboard' title='shift+.'>+ Keyboard Octave</button>
    <button id='decr-keyboard' title='shift+,'>- Keyboard Octave</button>
    <button id='incr-beat-size' title='shift+alt+='>+ Beat Size</button>
    <button id='decr-beat-size' title='shift+alt+-'>- Beat Size</button>
  </div>
  <div class='buttons'>
    <div>Output</div>
    <button id='export-abc'>Export (.abc)</button>
  </div>

</div>
`;
const rightPanel = `
<div id='right-panel'>
  <div id='main-panel'>
    <div id="canvas-div"></div>
  </div>
</div>
`;

const topPanel = `
<div id='top-panel'>

  <div id='midi-panel'>
    <div id="midi-div"></div>
  </div>

  <div id='nav-panel'>
    <div>
      <a id='home-link' href='index.html' title='Home page'>
        <i class="material-icons">home</i>
      </a>
    </div>
    <div>
      <button id='sign-in-button'>Sign In</button>
    </div>
    <div>
      <button id='toggle-view'>Edit</button>
    </div>
    <!--
    <div>
      <a id='about-link' href='about.html' title='Info page'>
        <i class="material-icons">info</i>
      </a>
    </div>
    -->
  </div>
</div>
`;

const bottomPanel = `
<div id='bottom-panel'>
  ${leftPanel}
  ${rightPanel}
</div>
`;

export const shadowRootHtml = `
${styleImport}
<div id='app'>
  ${topPanel}
  ${bottomPanel}
</div>
`;
