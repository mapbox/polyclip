(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.polyclip = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/mourner/Projects/polyclip/node_modules/tinyqueue/index.js":[function(require,module,exports){
'use strict';

module.exports = TinyQueue;

function TinyQueue(data, compare) {
    this.data = data || [];
    this.length = this.data.length;
    this.compare = compare || defaultCompare;

    if (data) for (var i = Math.floor(this.length / 2); i >= 0; i--) this._down(i);
}

function defaultCompare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

TinyQueue.prototype = {

    push: function (item) {
        this.data.push(item);
        this.length++;
        this._up(this.length - 1);
    },

    pop: function () {
        var top = this.data[0];
        this.data[0] = this.data[this.length - 1];
        this.length--;
        this.data.pop();
        this._down(0);
        return top;
    },

    peek: function () {
        return this.data[0];
    },

    _up: function (pos) {
        var data = this.data,
            compare = this.compare;

        while (pos > 0) {
            var parent = Math.floor((pos - 1) / 2);
            if (compare(data[pos], data[parent]) < 0) {
                swap(data, parent, pos);
                pos = parent;

            } else break;
        }
    },

    _down: function (pos) {
        var data = this.data,
            compare = this.compare,
            len = this.length;

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

},{}],"/Users/mourner/Projects/polyclip/polyclip.js":[function(require,module,exports){
'use strict';

var Queue = require('tinyqueue');

module.exports = clip;

var sqrEpsilon = 1e-10;

clip.INTERSECTION = 0;
clip.UNION = 1;

function clip(subject, clipping, type) {
    var events = [],
        result = [],
        i, e, edgeList;

    type = type || clip.INTERSECTION;

    for (i = 0; i < subject.length; i++) addToEvents(events, subject[i], true);
    for (i = 0; i < clipping.length; i++) addToEvents(events, clipping[i], false);

    var queue = new Queue(events, compareEvent);

    while (queue.length) {
        e = queue.pop();

        if (e.left) {
            edgeList = edgeListInsert(edgeList, e);

            setFlags(e, e.prev, type);

            handleIntersections(queue, e, e.next);
            handleIntersections(queue, e, e.prev);

        } else {
            e = e.other;

            edgeList = edgeListRemove(edgeList, e);

            handleIntersections(queue, e.prev, e.next);

            if (e.inResult) result.push([e.p, e.other.p]);
        }
    }

    return result;
}

function edgeListInsert(edgeList, e) {
    if (!edgeList) return e;

    var next = edgeList,
        prev;

    while (next && compareEdge(e, next) > 0) {
        prev = next;
        next = next.next;
    }

    if (prev) {
        prev.next = e;
        e.prev = prev;

    } else {
        edgeList = e;
    }

    e.next = next;
    if (next) next.prev = e;

    return edgeList;
}

function edgeListRemove(edgeList, e) {
    if (e.prev) e.prev.next = e.next;
    else edgeList = e.next;

    if (e.next) e.next.prev = e.prev;

    return edgeList;
}

function addToEvents(events, ring, isSubject) {
    var i, j, len, e1, e2;
    for (i = 0, len = ring.length, j = len - 1; i < len; j = i++) {

        if (equals(ring[i], ring[j])) continue;

        e1 = sweepEvent(ring[i], isSubject);
        e2 = sweepEvent(ring[j], isSubject);
        e1.other = e2;
        e2.other = e1;

        if (compareEvent(e1, e2) < 0) e1.left = true;
        else e2.left = true;

        events.push(e1);
        events.push(e2);
    }
}

function setFlags(e, e0, type) {
    if (!e0) {
        e.inOut = false;
        e.otherInOut = true;

    } else if (e.subject === e0.subject) {
        e.inOut = !e0.inOut;
        e.otherInOut = e0.otherInOut;

    } else {
        e.inOut = !e0.otherInOut;
        e.otherInOut = e0.inOut;
    }

    e.inResult =
        type === clip.INTERSECTION ? !e.otherInOut :
        type === clip.UNION ? e.otherInOut : false;
}

function handleIntersections(queue, e1, e2) {
    if (!e1 || !e2) return;

    var p0 = e1.p,
        p0b = e1.other.p,
        p1 = e2.p,
        p1b = e2.other.p;

    var ex = p1[0] - p0[0],
        ey = p1[1] - p0[1],
        d0x = p0b[0] - p0[0],
        d0y = p0b[1] - p0[1],
        d1x = p1b[0] - p1[0],
        d1y = p1b[1] - p1[1],
        cross = d0x * d1y - d0y * d1x,
        sqrLen0 = d0x * d0x + d0y * d0y,
        sqrLen1 = d1x * d1x + d1y * d1y,
        p;

    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLen1) {
        // lines are not parallel
        var s = (ex * d1y - ey * d1x) / cross;
        if (s < 0 || s > 1) return;

        var t = (ex * d0y - ey * d0x) / cross;
        if (t < 0 || t > 1) return;

        p = [p0[0] + s * d0x, p0[1] + s * d0y];

        if (!equals(p, p0) && !equals(p, p0b)) subdivideEdge(queue, e1, p);
        if (!equals(p, p1) && !equals(p, p1b)) subdivideEdge(queue, e2, p);

    }

    // lines are parallel
    var sqrLenE = ex * ex + ey * ey;
    cross = ex * d0y - ey * d0x;
    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLenE) return;

    // lines overlap
    // TODO
}

function subdivideEdge(queue, e, p) {
    var e1 = sweepEvent(p, e.subject),
        e2 = sweepEvent(p, e.subject),
        e3 = e.other;

    e2.left = true;

    e.other = e1;
    e1.other = e;
    e2.other = e3;
    e3.other = e2;

    queue.push(e1);
    queue.push(e2);
}

function equals(a, b) {
    var dx = b[0] - a[0],
        dy = b[1] - a[1];
    return dx * dx + dy * dy < sqrEpsilon;
}

function sweepEvent(p, isSubject) {
    return {
        p: p,
        other: null,
        left: false,
        subject: isSubject,
        inOut: false,
        otherInOut: false,
        inResult: false,
        prev: null,
        next: null
    };
}

function compareEvent(a, b) {
    return (a.p[0] - b.p[0]) || (a.p[1] - b.p[1]) || (a.left === b.left ? below(a, b.other.p) : a.left ? 1 : -1);
}
function compareEdge(a, b) {
    return equals(a.p, b.p) ? below(a, b.other.p) : -below(b, a.p);
}

function below(e, p) {
    return e.left ? area(e.p, e.other.p, p) : area(e.other.p, e.p, p);
}

function area(a, b, c) {
    var acx = a[0] - c[0],
        bcx = b[0] - c[0],
        acy = a[1] - c[1],
        bcy = b[1] - c[1];
    return acx * bcy - acy * bcx;
}


},{"tinyqueue":"/Users/mourner/Projects/polyclip/node_modules/tinyqueue/index.js"}]},{},["/Users/mourner/Projects/polyclip/polyclip.js"])("/Users/mourner/Projects/polyclip/polyclip.js")
});