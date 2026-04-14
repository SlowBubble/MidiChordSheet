import { setupKeyboard } from '../esModules/keyboard-to-midi-evt/index.js';
import * as pubSub from '../esModules/pub-sub/pubSub.js';

import { setupButtons } from './buttons.js';
import { setupKeyboardHandler } from './keyboardHandler.js';
import { setupMidiHandler } from './midiHandler.js';

const [keyboardEvtPub, keyboardEvtSub] = pubSub.make();

setupButtons();
setupMidiHandler();
setupKeyboardHandler(keyboardEvtSub);
setupKeyboard(keyboardEvtPub);
