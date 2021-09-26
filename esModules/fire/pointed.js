
import * as math from './math.js';

// A special doubly linked list for making local edit operations O(1).
export class List {
  constructor(array, idx) {
    array = array || [];
    idx = idx || 0;
    if (idx < 0 || idx > array.length) {
      // Note that idx <= array.length because RIGHT_END
      // is an extra node that is not in the array.
      console.warn('index, array length: ', idx, array.length)
      throw 'index out of bound';
    }
    this.rightEnd = new _Node("RIGHT_END");
    this.currNode = this.rightEnd;
    array.forEach(item => {
      this.add(item);
    });
    const idxFromRight = array.length - idx;
    math.range(0, idxFromRight).forEach(_ => {
      this.moveLeft();
    });
  }

  ////// Import/Export
  toArray() {
    let travNode = this.rightEnd;
    const rev = [];
    while (travNode.left) {
      travNode = travNode.left;
      rev.push(travNode.item);
    }
    return [...rev].reverse();
  }

  toArrayStartingFromCurr() {
    let travNode = this.currNode;
    const res = [];
    while (travNode && travNode !== this.rightEnd) {
      res.push(travNode.item);
      travNode = travNode.right;
    }
    return res;
  }

  ////// Access
  getCurr() {
    if (this.atTail()) {
      return null;
    }
    return this.currNode.item;
  }

  // Can return null;
  getLeft() {
    const left = this.currNode.left;
    return left ? left.item : null;
  }

  // Can return null;
  getRight() {
    const right = this.currNode.right;
    if (!right || right === this.rightEnd) {
      return null;
    }
    return right.item;
  }

  atTail() {
    return this.currNode === this.rightEnd;
  }

  atHead() {
    return !this.currNode.left;
  }

  get2ndLast() {
    if (this.rightEnd.left) {
      return this.rightEnd.left.item;
    }
    return null;
  }

  getCurrIdx() {
    let travNode = this.rightEnd;
    let idxFromRight = 0;
    while (true) {
      if (travNode === this.currNode) {
        return this.toArray().length - idxFromRight;
      }
      if (!travNode.left) {
        throw 'unable to find current index';
      }
      travNode = travNode.left;
      idxFromRight += 1;
    }
  }

  ////// Navigation
  moveLeft() {
    if (!this.currNode.left) {
      return false;
    }
    this.currNode = this.currNode.left;
    return true;
  }

  moveRight() {
    if (!this.currNode.right) {
      return false;
    }
    this.currNode = this.currNode.right;
    return true;
  }

  ////// Mutation
  // Add an item to the left of the current item. Current item remains the same item.
  add(item) {
    const newLeftLeft = this.currNode.left;
    const newNode = new _Node(item, newLeftLeft, this.currNode);
    this.currNode.left = newNode;
    if (newLeftLeft) {
      newLeftLeft.right = newNode;
    }
  }

  // Remove the item to the left of the current item.
  remove() {
    const oldLeft = this.currNode.left;
    if (!oldLeft) {
      return;
    }
    this.currNode.left = oldLeft.left;
    if (oldLeft.left) {
      oldLeft.left.right = this.currNode;
    }
  }

}

class _Node {
  constructor(item, left, right) {
    this.item = item;
    this.left = left;
    this.right = right;
  }
}
