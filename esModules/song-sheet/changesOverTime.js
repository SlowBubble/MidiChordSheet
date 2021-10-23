import { Frac, makeFrac } from "../fraction/fraction.js";

export class ChangesOverTime {
  constructor({
    changes = [],
    defaultVal = undefined,
  }) {
    if (defaultVal !== undefined) {
      this.defaultVal =  this._deserialize(defaultVal);
    }
    this.changes = changes.map(({start8n, val}) => {
      return new Change({start8n: start8n, val: this._deserialize(val)});
    });

    this._sortAndDedupChanges();
  }
  // This should be overriden.
  _deserialize(val) {
    return val;
  }
  // This should be overriden.
  _equal(a, b) {
    return a === b;
  }

  upsert(start8n, val) {
    this.changes.push({start8n: start8n, val: val});
    this._sortAndDedupChanges();
    this._dedupFirstChangeWithDefaultVal();
  }
  getChange(start8n, toTheLeft) {
    let currChange = new Change({start8n: makeFrac(0), val: this.defaultVal});
    for (const change of this.changes) {
      const usePrevChange = toTheLeft ? change.start8n.geq(start8n) : change.start8n.greaterThan(start8n);
      if (usePrevChange) {
        break;
      }
      currChange = change;
    }
    return currChange;
  }
  getChanges() {
    return this.changes;
  }
  // Remove changes if inside [start8n, end8n)
  removeWithinInterval(start8n, end8n) {
    this.changes = this.changes.filter(
      change => !(start8n.leq(change.start8n) && (!end8n || change.start8n.lessThan(end8n))));
    this._dedupFirstChangeWithDefaultVal();
  }

  _getStart8nStrToObj() {
    return _toMap(this.getChanges());
  }
  _sortAndDedupChanges() {
    this.changes.sort((a, b) => a.start8n.minus(b.start8n).toFloat());
    this.changes = this.changes.reduce((accum, currChange, idx) => {
      const prevObj = idx >= 1 ? this.changes[idx - 1].val : this.defaultVal;
      if (prevObj && this._equal(currChange.val, prevObj)) {
        return accum;
      }
      accum.push(currChange);
      return accum;
    }, []);
  }
  _dedupFirstChangeWithDefaultVal() {
    if (this.defaultVal !== undefined && this.changes.length > 0 && this._equal(this.defaultVal, this.changes[0].val)) {
      this.changes.splice(0, 1);
    }
  }
}

export class Change {
  constructor({
    start8n,
    // This val should already be deserialized.
    val,
  }) {
    this.start8n = new Frac(start8n);
    this.val = val;
  }
}

function _toMap(changes) {
  const map = {};
  changes.forEach(({start8n, val}) => {
    map[start8n.toString()] = val;
  });
  return map;
}
