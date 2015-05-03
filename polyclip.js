'use strict';

var Queue = require('tinyqueue');

module.exports = clip;

var sqrEpsilon = 1e-10;

clip.INTERSECTION = 0;
clip.UNION = 1;

var EDGE_NORMAL = 0,
    EDGE_NON_CONTRIBUTING = 1,
    EDGE_SAME_TRANSITION = 2,
    EDGE_DIFFERENT_TRANSITION = 3;

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

            var inResult =
                e.type === EDGE_NON_CONTRIBUTING ? false :
                type === clip.INTERSECTION ? e.inside || e.type === EDGE_SAME_TRANSITION :
                type === clip.UNION ? !e.inside || e.type === EDGE_SAME_TRANSITION : false;

            if (inResult) result.push([e.p, e.other.p]);

            edgeList = edgeListRemove(edgeList, e);

            handleIntersections(queue, e.prev, e.next);
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

function setFlags(e, e0) {
    if (!e0) {
        e.inOut = false;
        e.inside = false;

    } else if (e.subject === e0.subject) {
        e.inOut = !e0.inOut;
        e.inside = e0.inside;

    } else {
        e.inOut = e0.inside;
        e.inside = !e0.inOut;
    }
}

function handleIntersections(queue, e1, e2) {
    if (!e1 || !e2) return;

    var p0 = e1.p,
        p0b = e1.other.p,
        p1 = e2.p,
        p1b = e2.other.p,

        ex = p1[0] - p0[0],
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
        if (s < 0 || s > 1) return;

        var t = (ex * d0y - ey * d0x) / cross;
        if (t < 0 || t > 1) return;

        var p = [p0[0] + s * d0x, p0[1] + s * d0y];

        if (!equals(p, p0) && !equals(p, p0b)) subdivideEdge(queue, e1, p);
        if (!equals(p, p1) && !equals(p, p1b)) subdivideEdge(queue, e2, p);
        return;
    }

    // lines are parallel
    var sqrLenE = ex * ex + ey * ey;
    cross = ex * d0y - ey * d0x;
    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLenE) return; // lines are different

    // lines are colinear
    var s0 = (d0x * ex + d0y * ey) / sqrLen0,
        s1 = s0 + (d0x * d1x + d0y * d1y) / sqrLen0;

    if (s0 >= 1 || s1 <= 0) return; // no overlap

    // lines overlap
    if (s0 === 0) {
        if (s1 > 1) subdivideEdge(queue, e2, p0b); // e2 is longer
        else if (s1 < 1) subdivideEdge(queue, e1, p1b); // e1 is longer

        e1.type = EDGE_NON_CONTRIBUTING;
        e2.type = e1.inOut === e2.inOut ? EDGE_SAME_TRANSITION : EDGE_DIFFERENT_TRANSITION;
    } else {
        console.log('overlapping case not handled:');
        console.log(p0, p0b, p1, p1b);
        console.log(s0, s1);
    }
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

function sweepEvent(p, isSubject) {
    return {
        p: p,
        prev: null,
        next: null,
        other: null,
        subject: isSubject,
        left: false,
        inOut: false,
        inside: false,
        type: EDGE_NORMAL
    };
}

function compareEvent(a, b) {
    return (a.p[0] - b.p[0]) || (a.p[1] - b.p[1]) || (a.left === b.left ? below(a, b.other.p) : a.left ? 1 : -1);
}

function compareEdge(a, b) {
    return (equals(a.p, b.p) ? below(a, b.other.p) : -below(b, a.p)) || 1;
}

function below(e, p) {
    return e.left ? area(e.p, e.other.p, p) : area(e.other.p, e.p, p);
}

function equals(a, b) {
    var dx = b[0] - a[0],
        dy = b[1] - a[1];
    return dx * dx + dy * dy < sqrEpsilon;
}

function area(a, b, c) {
    var acx = a[0] - c[0],
        bcx = b[0] - c[0],
        acy = a[1] - c[1],
        bcy = b[1] - c[1];
    return acx * bcy - acy * bcx;
}
