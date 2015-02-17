'use strict';

var Heap = require('./heap');
var BSArray = require('./bsarray');

module.exports = clip;

var sqrEpsilon = 1e-10;

function clip(subject, clipping) {
    var events = [],
        intersection = [],
        union = [],
        k, e, pos, prev, next;

    for (k = 0; k < subject.length; k++) addToEvents(events, subject[k], true);
    for (k = 0; k < clipping.length; k++) addToEvents(events, clipping[k], false);

    var queue = new Heap(events, compareEvent),
        edgeTable = new BSArray(compareEdge);

    while (queue.length) {
        e = queue.pop();

        if (e.isLeft) {
            pos = edgeTable.insert(e);
        } else {
            // if (e.other.p[0] === 100 && e.other.p[1] === 10 && e.p[0] === 200 && e.p[1] === 110) debugger;
            pos = edgeTable.find(e.other);
        }

        prev = pos ? edgeTable.items[pos - 1] : null;
        next = pos < edgeTable.items.length - 1 ? edgeTable.items[pos + 1] : null;

        if (e.isLeft) {
            // console.log('opening', e.p.join(','), e.other.p.join(','));

            // console.log(edgeTable.items.map(function (e) {
            //     return e.p.join(',') + ' to ' + e.other.p.join(',');
            // }));
            // console.log('');

            // if (prev) console.log('prev', prev.p.join(',') + ' to ' + prev.other.p.join(','));
            setInsideFlag(e, prev);

            if (next) handleIntersections(queue, e, next);
            if (prev) handleIntersections(queue, e, prev);

        } else {
            // console.log('closing', e.other.p.join(','), e.p.join(','), e.other.isInside ? 'inside' : 'outside');
            if (e.other.isInside) intersection.push([e.p, e.other.p]);
            else union.push([e.p, e.other.p]);

            // console.log(edgeTable.items.map(function (e) {
            //     return e.p.join(',') + ' to ' + e.other.p.join(',');
            // }));

            edgeTable.removeAtIndex(pos);

            // console.log(edgeTable.items.map(function (e) {
            //     return e.p.join(',') + ' to ' + e.other.p.join(',');
            // }));
            // console.log('');

            if (prev && next) handleIntersections(queue, prev, next);
        }
    }

    // console.log(intersection);
    // console.log(union);
}

function addToEvents(events, ring, isSubject) {
    var i, j, len, e1, e2;
    for (i = 0, len = ring.length, j = len - 1; i < len; j = i++) {

        e1 = sweepEvent(ring[i], isSubject);
        e2 = sweepEvent(ring[j], isSubject);
        e1.other = e2;
        e2.other = e1;

        if (compareEvent(e1, e2) < 0) e1.isLeft = true;
        else e2.isLeft = true;

        events.push(e1);
        events.push(e2);
    }
}

function setInsideFlag(e, e0) {
    if (!e0) {
        e.isInside = e.isInOut = false;

    } else if (e.isSubject === e0.isSubject) {
        e.isInside = e0.isInside;
        e.isInOut = !e0.isInOut;

    } else {
        e.isInside = !e0.isInOut;
        e.isInOut = e0.isInside;
    }
}

function handleIntersections(queue, e1, e2) {
    var p1 = e1.p,
        p1b = e1.other.p,
        p2 = e2.p,
        p2b = e2.other.p;

    // nothing to do if endpoints match but edges don't overlap
    if (p1b === p2 || p2b === p1) return;

    // console.log('intersecting', p1.join(','), p1b.join(','), p2.join(','), p2b.join(','));

    var p = intersectEdges(p1, p1b, p2, p2b);

    // no intersections
    if (!p) return;

    // console.log('found intersection', p);

    if (!equals(p, p1) && !equals(p, p1b)) subdivideEdge(queue, e1, p);
    if (!equals(p, p2) && !equals(p, p2b)) subdivideEdge(queue, e2, p);

    // TODO overlap
}

function subdivideEdge(queue, e, p) {
    var e1 = sweepEvent(p, e.isSubject),
        e2 = sweepEvent(p, e.isSubject),
        e3 = e.other;

    e2.isLeft = true;

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

function intersectEdges(p0, p0b, p1, p1b) {
    var ex = p1[0] - p0[0],
        ey = p1[1] - p0[1],
        d0x = p0b[0] - p0[0],
        d0y = p0b[1] - p0[1],
        d1x = p1b[0] - p1[0],
        d1y = p1b[1] - p1[1],
        cross = d0x * d1y - d0y * d1x,
        sqrLen0 = d0x * d0x + d0y * d0y,
        sqrLen1 = d1x * d1x + d1y * d1y;

    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLen1) {
        // lines are not parallel
        var s = (ex * d1y - ey * d1x) / cross;
        if (s < 0 || s > 1) return false;

        var t = (ex * d0y - ey * d0x) / cross;
        if (t < 0 || t > 1) return false;

        return [p0[0] + s * d0x, p0[1] + s * d0y];
    }

    // lines are parallel
    var sqrLenE = ex * ex + ey * ey;
    cross = ex * d0y - ey * d0x;
    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLenE) return false;

    // lines overlap
    // TODO
    return false;
}

function sweepEvent(p, isSubject) {
    return {
        p: p,
        other: null,
        isLeft: false,
        isSubject: isSubject,
        isInOut: false,
        isInside: false,
        type: null
    };
}

function compareEvent(a, b) {
    var dx = a.p[0] - b.p[0];
    if (dx) return dx;

    var dy = a.p[1] - b.p[1];
    if (dy) return dy;

    if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;

    return -below(a, b.other.p);
}

function below(e, p) {
    if (e.isLeft) return area(e.p, e.other.p, p);
    return area(e.other.p, e.p, p);
}

function compareEdge(a, b) {
    // if (a === b) return 0;
    // if (area(a.p, a.other.p, b.p) !== 0 || area(a.p, a.other.p, b.other.p) !== 0) {
    //     if (equals(a.p, b.p)) return below(a, b.other.p);
    //     if (compareEvent(a, b) < 0) return above(b, a.p);
    //     return below(a, b.p);
    // }
    // if (equals(a.p, b.p)) return -1;
    // return compareEvent(a, b);
    if (equals(a.p, b.p)) return below(a, b.other.p);
    return -below(b, a.p);
}

function edgeY(a, b, x) {
    if (b[0] - a[0] === 0) return Math.min(a[1], b[1]);
    return (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) + a[1];
}

function area(a, b, c) {
    var acx = a[0] - c[0],
        bcx = b[0] - c[0],
        acy = a[1] - c[1],
        bcy = b[1] - c[1];
    return acx * bcy - acy * bcx;
}

console.time('clip');

for (var i = 0; i < 20000; i++)
clip(
    [[[0, 0],[100,100],[200,0]]],
    [[[100, 10],[200,110],[300,10]]]
);

console.timeEnd('clip');
