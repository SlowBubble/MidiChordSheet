import * as midiEvent from '../midi-data/midiEvent.js';

export const instruments = Object.freeze({
  acoustic_grand_piano: 'acoustic_grand_piano',
  honkytonk_piano: 'honkytonk_piano',
  electric_grand_piano: 'electric_grand_piano',
  electric_guitar_clean: 'electric_guitar_clean',
  // A softer but more sustained sound
  electric_piano_1: 'electric_piano_1',
  // A more electric and sustained sound
  electric_piano_2: 'electric_piano_2',
  // A percussive sound used to set the tempo
  synth_drum: 'synth_drum',
  // // Borderline okay.
  // acoustic_guitar_steel: 'acoustic_guitar_steel',
  // // A mellow sound
  // music_box: 'music_box',
});

// Load more if needed later.
const basicInstrumentsArr = [
  instruments.acoustic_grand_piano,
  instruments.honkytonk_piano,
  instruments.electric_piano_1,
  instruments.electric_piano_2,
  instruments.electric_grand_piano,
  instruments.electric_guitar_clean,
  instruments.synth_drum,
];

export class MusicalSound {
  constructor({midiJs, soundSub, eBanner, readyPub}) {
    this._channelNumtoNoteNums = {};
    this._midiJs = midiJs;
    this._isReady = false;
    this._eBanner = eBanner;
    this._soundSub = soundSub;
    this._loadedInstruments = [];
    this._readyPub = readyPub;

    this._load();
  }
  _load(instrumentsArr, channelInfos) {
    this._loadedInstruments = instrumentsArr || basicInstrumentsArr
    this._isReady = false;
    this._midiJs.loadPlugin({
      soundfontUrl: "./lib/midi.js/soundfont/",
      instruments: this._loadedInstruments,
      onsuccess: _ => {
        this._isReady = true;
        this._eBanner.success('Sound enabled.');
        this.configure(channelInfos);

        if (this._soundSub) {
          this._soundSub(midiEvt => {
            this.execute(midiEvt);
          });
        }
        if (this._readyPub) {
          this._readyPub();
        }
      }
    });
  }

  // TODO call _load if not all instruments are loaded
  configure(channelInfos) {
    channelInfos = channelInfos || [{
      channelNum: 0,
      instrumentName: instruments.acoustic_grand_piano,
    },
    {
      channelNum: 1,
      instrumentName: instruments.acoustic_grand_piano,
    }];
    const defaultVolume = 60;
    channelInfos.forEach(channelInfo => {
      this._midiJs.programChange(channelInfo.channelNum, this._midiJs.GM.byName[channelInfo.instrumentName].number);
      this._midiJs.setVolume(channelInfo.channelNum, defaultVolume);
    });
  }

  // midiEvt being null means stopping all sounds.
  execute(midiEvt) {
    play(midiEvt, this._midiJs);
    updateState(midiEvt, this._channelNumtoNoteNums);
  }

  stopAll() {
    stop(this._channelNumtoNoteNums, this._midiJs);
    this._channelNumtoNoteNums = {};
  }
}

function updateState(midiEvt, channelNumtoNoteNums) {
  const noteNumsMap = channelNumtoNoteNums[midiEvt.channelNum] || {};
  if (midiEvt.type == midiEvent.midiEvtType.NoteOn) {
    noteNumsMap[midiEvt.noteNum] = true;
    channelNumtoNoteNums[midiEvt.channelNum] = noteNumsMap;
  }
  if (midiEvt.type == midiEvent.midiEvtType.NoteOff) {
    delete noteNumsMap[midiEvt.noteNum];
  }
}

function stop(channelNumtoNoteNums, midiJs) {
  Object.entries(channelNumtoNoteNums).forEach(([channelNum, noteNums]) => {
    Object.keys(noteNums).forEach(noteNum => play(new midiEvent.NoteOffEvt({
      noteNum: noteNum,
      channelNum: channelNum,
    }), midiJs))
  });
}

function play(midiEvt, midiJs) {
  if (midiEvt.type == midiEvent.midiEvtType.NoteOn) {
    const volume = midiEvt.velocity;
    midiJs.noteOn(midiEvt.channelNum, midiEvt.noteNum, volume);
  }
  if (midiEvt.type == midiEvent.midiEvtType.NoteOff) {
    midiJs.noteOff(midiEvt.channelNum, midiEvt.noteNum);
  }
}
