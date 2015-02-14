'use strict';

var Heap = require('./heap');

var testData = [];
for (var i = 0; i < 1000000; i++) {
    testData.push(Math.round(Math.random() * 1000000));
}



var testDataCopy = testData.slice();

console.time('heapify existing array');
var heap = new Heap(testDataCopy);
console.timeEnd('heapify existing array');

console.time('pop one by one');
while (heap.length) heap.pop();
console.timeEnd('pop one by one');

console.time('build heap one by one');
heap = new Heap();
for (var i = 0; i < testData.length; i++) heap.push(testData[i]);
console.timeEnd('build heap one by one');
