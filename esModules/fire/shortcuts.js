

export function setup(actionMgr, stateMgr, eBanner, disablePub, hasMidiInputsFunc) {

  hotkeys('a,b,c,d,e,f,g', evt => {
    if (!stateMgr.isChordMode()) {
      return;
    }
    evt.preventDefault();
    const root = evt.key.toUpperCase();
    const chordStr = prompt('Chord extension name of ' + root);
    actionMgr.exec(_ => {
      const inserted = stateMgr.insertChord(root + chordStr);
      if (inserted) {
        stateMgr.navRight();
      }
    });
  });

  hotkeys('space', evt => {
    if (hasMidiInputsFunc()) {
      return;
    }
    evt.preventDefault();
    actionMgr.exec(_ => {
      if (stateMgr.isChordMode()) {
        stateMgr.navRight();
        return;
      }
      // TODO be smarter about the duration, i.e. if it's 8/9 filled, duration should be 1/9.
      stateMgr.upsertWithoutDur([]);
    });
  });

  hotkeys('shift+space', evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      if (stateMgr.isChordMode()) {
        // TODO remove chord also.
        stateMgr.navRight();
        return;
      }
      stateMgr.upsertWithoutDur([null]);
    });
  });

  hotkeys('alt+shift+space', evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      if (stateMgr.isChordMode()) {
        return;
      }
      stateMgr.insertSpace();
    });
  });

  hotkeys('alt+shift+backspace', evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      if (stateMgr.isChordMode()) {
        return;
      }
      stateMgr.deleteSpace();
    });
  });

  hotkeys('backspace', evt => {
    evt.preventDefault();
    disablePub();

    actionMgr.exec(_ => {
      if (stateMgr.isChordMode()) {
        stateMgr.removeChord();
        return;
      }
      stateMgr.shortenPrevNoteGp();
    });
  });


  hotkeys(`${_cmdKeyString()}+backspace`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.deletePrevMeasure();
    });
  });

  hotkeys(`${_cmdKeyString()}+shift+backspace`, evt => {
    evt.preventDefault();
    if(!confirm('Delete document?')) {
      return;
    }
    actionMgr.exec(_ => {
      stateMgr.deleteDoc();
    });
  });

  hotkeys('enter', evt => {
    evt.preventDefault();
    if (!stateMgr.isChordMode()) {
      return;
    }
    const selected = stateMgr.getSelectedChord();
    const chordStr = prompt('Chord name', selected ? selected.toString() : '');
    actionMgr.exec(_ => {
      const inserted = stateMgr.insertChord(chordStr);
      if (inserted) {
        stateMgr.navRight();
      }
    });
  });

  hotkeys('shift+enter', evt => {
    evt.preventDefault();
    actionMgr.addVoice();
  });

  hotkeys('shift+backspace', evt => {
    evt.preventDefault();
    actionMgr.removeVoice();
  });

  hotkeys('down', evt => {
    evt.preventDefault();
    disablePub();

    actionMgr.exec(_ => {
      stateMgr.goDown();
    });
  });

  hotkeys('up', evt => {
    evt.preventDefault();
    disablePub();

    actionMgr.exec(_ => {
      stateMgr.goUp();
    });
  });

  hotkeys('left', evt => {
    evt.preventDefault();
    disablePub();

    actionMgr.exec(_ => {
      stateMgr.navLeft();
    });
  });

  hotkeys('right', evt => {
    evt.preventDefault();
    disablePub();

    actionMgr.exec(_ => {
      stateMgr.navRight();
    });
  });

  hotkeys('alt+left', evt => {
    if (stateMgr.atHead()) {
      // Allow default, which means browser navigating backward.
      return;
    }
    evt.preventDefault();
    actionMgr.shiftNoteGpBoundary(true);
  });

  hotkeys('alt+right', evt => {
    evt.preventDefault();
    actionMgr.shiftNoteGpBoundary(false);
  });

  hotkeys(`${_cmdKeyString()}+left`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.navLeftMeasure();
    });
  });

  hotkeys(`${_cmdKeyString()}+up`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.navHead();
    });
  });

  hotkeys(`${_cmdKeyString()}+down`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.navTail();
    });
  });

  hotkeys(`${_cmdKeyString()}+s`, evt => {
    evt.preventDefault();
    stateMgr.save();
  });

  hotkeys(`${_cmdKeyString()}+shift+s`, evt => {
    evt.preventDefault();
    stateMgr.save(true);
  });

  hotkeys(`shift+r`, evt => {
    evt.preventDefault();
    stateMgr.loadParts(true);
  });

  hotkeys(`shift+q`, evt => {
    evt.preventDefault();
    actionMgr.quantize();
  });

  hotkeys(`shift+m`, evt => {
    evt.preventDefault();
    actionMgr.toggleDisplayMelodyOnly();
  });

  hotkeys(`shift+y`, evt => {
    evt.preventDefault();
    actionMgr.toggleDisplayLyrics();
  });

  hotkeys(`shift+g`, evt => {
    evt.preventDefault();
    actionMgr.insertGraceNote();
  });

  hotkeys(`shift+l`, evt => {
    evt.preventDefault();
    actionMgr.updateLyrics();
  });

  hotkeys(`shift+v`, evt => {
    stateMgr.toggleView();
  });

  hotkeys(`shift+s`, evt => {
    actionMgr.toggleShowSpelling();
  });

  hotkeys(`shift+alt+[`, evt => {
    actionMgr.exec(_ => {
      eBanner.display(`Seed: ${stateMgr.decrSeed()}`);
    });
  });

  hotkeys(`shift+alt+]`, evt => {
    actionMgr.exec(_ => {
      eBanner.display(`Seed: ${stateMgr.incrSeed()}`);
    });
  });

  hotkeys(`shift+k`, evt => {
    actionMgr.setKeySig();
  });

  hotkeys(`${_cmdKeyString()}+k`, evt => {
    evt.preventDefault();
    actionMgr.transpose();
  });

  hotkeys(`${_cmdKeyString()}+right`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.navRightMeasure();
    });
  });

  hotkeys('alt+shift+1', evt => {
    evt.preventDefault();
    actionMgr.addSimpleBass();
  });
  hotkeys('alt+shift+2', evt => {
    evt.preventDefault();
    actionMgr.addTwoBeatBass();
  });
  hotkeys('alt+shift+3', evt => {
    evt.preventDefault();
    actionMgr.addBossaNovaBass();
  });

  hotkeys('shift+1', evt => {
    evt.preventDefault();
    actionMgr.addSimpleComping();
  });
  hotkeys('shift+2', evt => {
    evt.preventDefault();
    actionMgr.addOneBeatComping();
  });
  hotkeys('shift+3', evt => {
    evt.preventDefault();
    actionMgr.addFingerStyleComping();
  });
  hotkeys('shift+4', evt => {
    evt.preventDefault();
    actionMgr.addMelodicComping();
  });

  hotkeys('shift+c', evt => {
    evt.preventDefault();
    actionMgr.toggleClef();
  });

  hotkeys('shift+w', evt => {
    evt.preventDefault();
    const name = window.prompt('Name of the composer');
    if (!name) {
      return;
    }
    actionMgr.exec(_ => {
      stateMgr.setComposer(name);
    });
  });

  hotkeys('shift+n', evt => {
    evt.preventDefault();
    const name = window.prompt('Name of the song', stateMgr.getTitle());
    if (!name) {
      return;
    }
    actionMgr.exec(_ => {
      stateMgr.setTitle(name);
    });
  });

  hotkeys('shift+i', evt => {
    evt.preventDefault();
    stateMgr.switchInstrumentFingering();
  });

  hotkeys('shift+t', evt => {
    evt.preventDefault();
    actionMgr.setTempo();
  });

  hotkeys('shift+p', evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      const beats = parseInt(window.prompt('Number of beats in pickup'));
      if (isNaN(beats)) {
        return;
      }
      stateMgr.setPickupFromBeat(beats);
    });
  });

  hotkeys('shift+d', evt => {
    evt.preventDefault();
    actionMgr.exportAbc(_ => {
      prompt("Press cmd+C to copy ABC output for debugging.", stateMgr.getAbc());
    });
  });

  hotkeys('shift+f', evt => {
    evt.preventDefault();
    actionMgr.toggle24And44();
  });

  hotkeys('shift+=', evt => {
    evt.preventDefault();
    actionMgr.incrTimeSigNumer();
  });

  hotkeys('shift+-', evt => {
    evt.preventDefault();
    actionMgr.decrTimeSigNumer();
  });

  hotkeys('shift+alt+=', evt => {
    evt.preventDefault();
    actionMgr.incrStep();
  });

  hotkeys('shift+alt+-', evt => {
    evt.preventDefault();
    actionMgr.decrStep();
  });

  hotkeys('shift+,', evt => {
    evt.preventDefault();
    actionMgr.decrNoteNumShift();
  });

  hotkeys('shift+.', evt => {
    evt.preventDefault();
    actionMgr.incrNoteNumShift();
  });

  hotkeys(`${_cmdKeyString()}+c`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.copy();
    });
  });
  hotkeys(`${_cmdKeyString()}+x`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.cut();
    });
  });
  hotkeys(`${_cmdKeyString()}+v`, evt => {
    evt.preventDefault();
    actionMgr.exec(_ => {
      stateMgr.paste();
    });
  });

  hotkeys(`${_cmdKeyString()}+z`, evt => {
    evt.preventDefault();
    actionMgr.undo();
  });

  hotkeys(`${_cmdKeyString()}+shift+z`, evt => {
    evt.preventDefault();
    actionMgr.redo();
  });

}

function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

export function cmdKey() {
  if (isMac()) {
    return 'metaKey';
  }
  return 'ctrlKey';
}

function _cmdKeyString() {
  if (isMac()) {
    return 'command';
  }
  return 'ctrl';
}
