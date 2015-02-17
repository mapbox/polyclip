'use strict';

module.exports = BSArray;

// really simple pseudo-bst array wrapper

function BSArray(compare) {
    this.compare = compare || defaultCompare;
    this.items = new Array(100);
    this.length = 0;
}

BSArray.prototype = {

    insert: function (item, value) {

        var items = this.items,
            compare = this.compare,
            i = 0,
            j = this.length - 1;

        while (i <= j) {
            var mid = Math.floor((i + j) / 2);
            var c = compare(item, items[mid]);

            if (c === 0) {
                i = mid;
                break;
            }
            else if (c < 0) j = mid - 1;
            else i = mid + 1;
        }

        items.splice(i, 0, item);
        this.length++;
        return i;
    },

    find: function (item) {

        var items = this.items,
            compare = this.compare,
            i = 0,
            j = this.length - 1;

        while (i <= j) {
            var mid = Math.floor((i + j) / 2);
            var c = compare(item, items[mid]);

            if (c === 0) return mid;
            if (c < 0) j = mid - 1;
            else i = mid + 1;
        }

        throw new Error('Fatal. Should not happen.');
    },

    removeAtIndex: function (index) {
        this.items.splice(index, 1);
        this.length--;
    }
};

function defaultCompare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

