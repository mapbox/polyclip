'use strict';

module.exports = Heap;

function Heap(data, compare) {
    this.data = data || [];
    this.length = this.data.length;
    this.compare = compare || defaultCompare;

    if (data) for (var i = Math.floor(this.length / 2); i >= 0; i--) this._bubbleDown(i);
}

Heap.prototype = {
    push: function (item) {
        this.data.push(item);
        this.length++;
        this._bubbleUp(this.length - 1);
    },

    pop: function () {
        var top = this.data[0];
        this.data[0] = this.data[this.length - 1];
        this.length--;
        this.data.pop();
        this._bubbleDown(0);
        return top;
    },

    _bubbleUp: function (pos) {
        while (pos > 0) {
            var parent = Math.floor((pos - 1) / 2);

            if (this.compare(this.data[pos], this.data[parent]) < 0) {
                swap(this.data, parent, pos);
                pos = parent;

            } else break;
        }
    },

    _bubbleDown: function (pos) {
        var data = this.data,
            compare = this.compare,
            len = data.length;

        while (true) {
            var left = 2 * pos + 1,
                right = left + 1,
                min = pos;

            if (left < len && compare(data[left], data[min]) < 0) min = left;
            if (right < len && compare(data[right], data[min]) < 0) min = right;

            if (min === pos) return;

            swap(data, min, pos);
            pos = min;
        }
    }
};

function swap(data, i, j) {
    var tmp = data[i];
    data[i] = data[j];
    data[j] = tmp;
}

function defaultCompare(a, b) {
    return a - b;
}
