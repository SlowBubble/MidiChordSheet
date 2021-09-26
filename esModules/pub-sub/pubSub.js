/**
 * Usage:
    const [noteOnPub, noteOnSub] = pubsub.make();
    noteOnSub(data => { console.log('Received', data); });
    noteOnPub(42);
 *   
 *   
 */

export function make() {
  const evtMgr = new EvtMgr;
  return [evtMgr.pub, evtMgr.sub, evtMgr.switch];
}

export function makePubSub() {
  return make();
}

// If any of the subs recieved an event, the new sub will also receive an event. (OR)
export function makeSub(...subs) {
  const [mergedPub, mergedSub] = make();
  subs.forEach(sub => {
    sub((...args) => {
      mergedPub(...args);
    })
  });
  return mergedSub;
}

// If we call the new pub, all pubs will be called. (AND)
export function makePub(...pubs) {
  const [mergedPub, mergedSub] = make();
  mergedSub((...args) => {
    pubs.forEach(pub => {
      pub(...args);
    });
  });
  return mergedPub;
}

class EvtMgr {
  constructor() {
    this.handlers = [];
    this.isOn = true;

    // This weird way of defining methods is needed to support
    // the usage of passing EvtMgr.pub instead of EvtMgr into
    // other callers, so that this.handlers is defined.
    this.pub = (...args) => {
      this.handlers.forEach(handler => {
        if (this.isOn) {
          handler(...args);
        }        
      });
    }
    this.sub = handler => {
      if (typeof handler !== "function") {
        throw "handler must be a funtion";
      }
      this.handlers.push(handler);
    };
    this.switch = onOrOff  => {
      this.isOn = onOrOff;
    }
  }
}
