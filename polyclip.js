'use strict';

var Heap = require('./heap');
var DebugViz = require('./viz');

var viz = new DebugViz('canvas');

module.exports = clip;

var sqrEpsilon = 1e-10;

function clip(subject, clipping) {
    var events = [],
        intersection = [],
        union = [],
        k, e, pos, prev, next;

    for (k = 0; k < subject.length; k++) addToEvents(events, subject[k], true);
    for (k = 0; k < clipping.length; k++) addToEvents(events, clipping[k], false);

    viz.scale([subject, clipping]);
    viz.poly(subject, 'transparent', 'rgba(255,0,0,0.05)');
    viz.poly(clipping, 'transparent', 'rgba(0,255,0,0.05)');

    var queue = new Heap(events, compareEvent),
        edgeList = null;

    var k = 0;

    while (queue.length) {
        e = queue.pop();

        // viz.clear();
        // viz.poly([subject, clipping], 'gray');
        // viz.vertical(e.p[0], 'yellow');

        // var node = edgeList;
        // while (node) {
        //     viz.poly([node.p, node.other.p], 'red');
        //     node = node.next;
        // }
        // debugger;

        k++;

        if (e.isLeft) {
            edgeList = edgeListInsert(edgeList, e);

            // console.log('opening', e.p.join(','), e.other.p.join(','));

            setInsideFlag(e, e.prev);

            // viz.poly([e.p, e.other.p], 'red');

            // if (e.prev) viz.poly([e.prev.p, e.prev.other.p], 'red');
            // if (e.next) viz.poly([e.next.p, e.next.other.p], 'red');
            // debugger;

            if (e.next) handleIntersections(queue, e, e.next);
            if (e.prev) handleIntersections(queue, e, e.prev);

        } else {
            e = e.other;

            // console.log('closing', e.other.p.join(','), e.p.join(','), e.other.isInside ? 'inside' : 'outside');
            if (e.isInside) {
                intersection.push([e.p, e.other.p]);
                // console.log(e.p.id, e.other.p.id);

            } else union.push([e.p, e.other.p]);

            edgeList = edgeListRemove(edgeList, e);

            if (e.prev && e.next) handleIntersections(queue, e.prev, e.next);
        }
    }

    // console.log(k);

    viz.poly(intersection, 'red');
    viz.poly(union, 'blue');
}

function edgeListInsert(edgeList, e) {
    var next, prev;

    if (!edgeList) edgeList = e;
    else {
        next = edgeList;
        while (next && compareEdge(e, next) > 0) {
            prev = next;
            next = next.next;
        }
        if (prev) {
            prev.next = e;
            e.prev = prev;
        } else edgeList = e;

        e.next = next;
        if (next) next.prev = e;
    }
    return edgeList;
}

function edgeListRemove(edgeList, e) {
    if (e.prev) e.prev.next = e.next;
    else edgeList = e.next;

    if (e.next) e.next.prev = e.prev;

    return edgeList;
}

var id = 0;

function addToEvents(events, ring, isSubject) {
    var i, j, len, e1, e2;
    for (i = 0, len = ring.length, j = len - 1; i < len; j = i++) {

        if (equals(ring[i], ring[j])) continue;

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
    // console.count('subdivide');

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

var id = 1;

function sweepEvent(p, isSubject) {
    // p.id = p.id || id++;
    return {
        p: p,
        other: null,
        isLeft: false,
        isSubject: isSubject,
        isInOut: false,
        isInside: false,
        type: null,
        prev: null,
        next: null
    };
}

function compareEvent(a, b) {
    var dx = a.p[0] - b.p[0];
    if (dx) return dx;

    var dy = a.p[1] - b.p[1];
    if (dy) return dy;

    if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;

    return below(a, b.other.p);
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

function area(a, b, c) {
    var acx = a[0] - c[0],
        bcx = b[0] - c[0],
        acy = a[1] - c[1],
        bcy = b[1] - c[1];
    return acx * bcy - acy * bcx;
}

function randomRing(N) {
    var ring = [];
    for (var i = 0; i < N; i++) {
        ring.push([Math.random(), Math.random()]);
    }
    return ring;
}

console.time('clip');

// for (var i = 0; i < 20000; i++)
clip(
    [randomRing(100)],
    [randomRing(100)]
);

console.timeEnd('clip');
