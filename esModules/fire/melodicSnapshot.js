
export class NoteGpsMgr {
  constructor(beatModeSub, stateMgr, aggrStoppedSub) {
    this.stateMgr = stateMgr;
    let prevBeatMode = false;
    this.idx = 0;
    this.noteGps = null;
    beatModeSub(beatMode => {
      if (!prevBeatMode && beatMode) {
        this.idx = 0;
        this.noteGpsArr = this._initNoteGpsArr();
      }
      prevBeatMode = beatMode;

    });
    // This happens after beat mode becomes false; we reset.
    aggrStoppedSub(_ => {
      // Transfer remainder of noteGpsArr into stateMgr or
      // else it may be gone because of upsert of longer notes.
      if (this.idx > 0) {
        stateMgr.truncateRight();
        stateMgr.insertNoteGps(this.noteGpsArr.slice(this.idx), true);
      }
      this.idx = 0;
      this.noteGpsArr = null;
    });
  }

  _initNoteGpsArr() {
    const rightOfCursor = this.stateMgr.getCurrVoice().noteGps.toArray().filter(noteGp => {
      // This assumes there is no grace notes.
      return noteGp.start.geq(this.stateMgr.getCursorTime());
    });
    for (let idx = 0; idx < rightOfCursor.length; idx++) {
      if (!rightOfCursor[idx].isRest()) {
        return rightOfCursor.slice(idx);
      }
    }
    return [];
  }

  isOutOfBound() {
    return this.idx >= this.noteGpsArr.length;
  }

  getCurrNoteNums() {
    if (!this.noteGpsArr) {
      this.noteGpsArr = this._initNoteGpsArr();
    }
    if (this.isOutOfBound()) {
      return [60];
    }
    const noteGp = this.noteGpsArr[this.idx];
    return noteGp.notes.map(note => {return note.noteNum;});
  }

  getCurrNoteNumsAndIncr() {
    const res = this.getCurrNoteNums();
    this.idx++;
    return res;
  }
}