/*global describe, it*/
'use strict';

var should = require('should'),
    testData = require('./testData.js'),
    fakeAmqp = require('exp-fake-amqp');

require('mocha');

console.log('doing stuff');

delete require.cache[require.resolve('../')];

var rabbitClient = require('../');

describe('gulp-cache-refresh', function () {

    rabbitClient = new rabbitClient();
    rabbitClient.start(testData.testHandlers, testData.testConfig);

    it('should connect to queue', function (done) {
        should.exist(done,"hello");
    });
});