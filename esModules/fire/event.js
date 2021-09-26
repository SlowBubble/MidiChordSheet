/**
 * @fileoverview Description of this file.
 */

export const pubsub = () => {
  const evtMgr = new EvtMgr;
  return [evtMgr.pub, evtMgr.sub];
}

export class EvtMgr {
  constructor() {
    this.handlers = [];

    // This weird way of defining methods is needed to support
    // the usage of passing EvtMgr.pub instead of EvtMgr into
    // other callers, so that this.handlers is defined.
    this.pub = (...args) => {
      this.handlers.forEach(handler => {
        handler(...args);
      });
    }
    this.sub = handler => {
      if (typeof handler !== "function") {
        throw "handler must be a funtion";
      }
      this.handlers.push(handler);
    };
  }
}
