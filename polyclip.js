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
        sortedEvents = [],
        result = [],
        i, e, edgeList;

    type = type || clip.INTERSECTION;

    for (i = 0; i < subject.length; i++) addToEvents(events, subject[i], true);
    for (i = 0; i < clipping.length; i++) addToEvents(events, clipping[i], false);

    var queue = new Queue(events, compareEvent);

    while (queue.length) {
        e = queue.pop();
        sortedEvents.push(e);

        if (e.left) {
            edgeList = edgeListInsert(edgeList, e);

            setFlags(e, e.prev, type);

            handleIntersections(queue, e, e.next, type);
            handleIntersections(queue, e, e.prev, type);

        } else {
            edgeList = edgeListRemove(edgeList, e.other);

            handleIntersections(queue, e.other.prev, e.other.next, type);
        }
    }

    sortEvents(sortedEvents);

    return computeContours(sortedEvents);
    // return result;
}

function sortEvents(events) {
   for (var i = 0, j; i < events.length; i++) {
      var value = events[i];
      for (j = i - 1; j >= 0 && compareEvent(events[j], value) > 0; j--) events[j + 1] = events[j];
      events[j + 1] = value;
   }
}

function computeContours(sortedEvents) {
    var result = [],
        events = [];

    for (var i = 0; i < sortedEvents.length; i++) {
        var e = sortedEvents[i];
        if (e.left ? e.inResult : e.other.inResult) {
            e.pos = events.length;
            events.push(e);
            result.push([e.p, e.other.p]);
        }
    }

    // console.log(events.map(function (e) {
    //     return e.p[0] + ':' + e.p[1] + ' ' + e.pos + '->' + e.other.pos;
    // }));

    // return result;

    for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (!events[i].processed) {
            var contour = computeContour(events, events[i]);
            if (contour.length <= 2) continue;
            // if (contour.length > ) continue;
            result.push(contour);
        }
    }

    console.log(JSON.stringify(result));

    return result;
}

function computeContour(events, e) {
    var contour = [e.p],
        current = e.other;

    e.processed = true;
    current.processed = true;

    var k = 0;

    while (!equals(current.p, e.p)) {
        contour.push(current.p);
        k++;

        var prev = events[current.pos - 1];
        var next = events[current.pos + 1];
        if (next && equals(next.p, current.p)) current = next;
        else if (prev && equals(prev.p, current.p)) current = prev;

        // if (current.processed) break;

        current.processed = true;

        current = current.other;
        // if (current.processed) break;
        current.processed = true;
    }

    contour.push(current.p);

    return contour;
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
        e.inside = false;

    } else if (e.subject === e0.subject) {
        e.inOut = !e0.inOut;
        e.inside = e0.inside;

    } else {
        e.inOut = e0.inside;
        e.inside = !e0.inOut;
    }

    e.inResult =
        type === clip.INTERSECTION ? e.inside :
        type === clip.UNION ? !e.inside : false;
}

function handleIntersections(queue, e1, e2, type) {
    if (!e1 || !e2) return;

    var p1 = e1.p,
        p1b = e1.other.p,
        p2 = e2.p,
        p2b = e2.other.p,

        ex = p2[0] - p1[0],
        ey = p2[1] - p1[1],
        d1x = p1b[0] - p1[0],
        d1y = p1b[1] - p1[1],
        d2x = p2b[0] - p2[0],
        d2y = p2b[1] - p2[1],
        cross = d1x * d2y - d1y * d2x,
        sqrLen0 = d1x * d1x + d1y * d1y,
        sqrLen1 = d2x * d2x + d2y * d2y;

    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLen1) {
        // lines are not parallel
        var s = (ex * d2y - ey * d2x) / cross;
        if (s < 0 || s > 1) return;

        var t = (ex * d1y - ey * d1x) / cross;
        if (t < 0 || t > 1) return;

        var p = [p1[0] + s * d1x, p1[1] + s * d1y];

        if (!equals(p, p1) && !equals(p, p1b)) subdivideEdge(queue, e1, p);
        if (!equals(p, p2) && !equals(p, p2b)) subdivideEdge(queue, e2, p);
        return;
    }

    // lines are parallel
    var sqrLenE = ex * ex + ey * ey;
    cross = ex * d1y - ey * d1x;
    if (cross * cross > sqrEpsilon * sqrLen0 * sqrLenE) return; // lines are different

    if (e1.subject === e2.subject) return;

    // lines are colinear
    var s0 = (d1x * ex + d1y * ey) / sqrLen0,
        s1 = s0 + (d1x * d2x + d1y * d2y) / sqrLen0;

    if (s0 >= 1 || s1 <= 0) return; // no overlap

    return;

    // lines overlap
    if (s0 <= 0) {
        var e3 = s0 < 0 ? subdivideEdge(queue, e2, p1) : e2;

        e1.inResult =
            type === clip.INTERSECTION || type === clip.UNION ? e1.inOut === e2.inOut : false;
        e3.inResult = false;
        // e1.type = EDGE_NON_CONTRIBUTING;
        // e3.type = e1.inOut === e2.inOut ? EDGE_SAME_TRANSITION : EDGE_DIFFERENT_TRANSITION;

        if (s1 < 1) subdivideEdge(queue, e1, p2b);
        else if (s1 > 1) subdivideEdge(queue, e3, p1b);

    } else {
        console.log('unhandled overlap', p1, p1b, p2, p2b, s0, s1);
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

    return e2;
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
        type: EDGE_NORMAL,
        pos: null,
        processed: false
    };
}

function compareEvent(a, b) {
    return (a.p[0] - b.p[0]) ||
           (a.p[1] - b.p[1]) ||
           (a.left !== b.left && (a.left ? 1 : -1)) ||
           -below(a, b.other.p) ||
           (a.subject !== b.subject && (a.subject ? -1 : 1)) || 0;
}

function compareEdge(a, b) {
    return orient(a.p, a.other.p, b.p) === 0 && orient(a.p, a.other.p, b.other.p) === 0 ? compareEvent(a, b) :
           equals(a.p, b.p) ? -below(a, b.other.p) :
           a.p[0] === b.p[0] ? a.p[1] - b.p[1] :
           compareEvent(a, b) > 0 ? below(b, a.p) : -below(a, b.p);
}
function below(e, p) {
    return e.left ? orient(e.p, e.other.p, p) : orient(e.other.p, e.p, p);
}

function equals(a, b) {
    var dx = b[0] - a[0],
        dy = b[1] - a[1];
    return dx * dx + dy * dy < sqrEpsilon;
}

function orient(a, b, c) {
    var acx = a[0] - c[0],
        bcx = b[0] - c[0],
        acy = a[1] - c[1],
        bcy = b[1] - c[1];
    return acx * bcy - acy * bcx >= 0 ? 1 : -1;
}
