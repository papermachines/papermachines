"use strict";

var server = require("./server");
var before = require("sdk/test/utils").before;

var fakeItem = {
    "id": -1,
    "itemType": "webpage",
    "last-modified": new Date(1999, 0, 1)
};

var fakeItemOlder = {
    "id": -1,
    "itemType": "webpage",
    "last-modified": new Date()
};

function onError(assert, done) {
    return function(error) {
        assert.fail(error);
        done();
    };
}

exports["test create new corpus"] = function(assert, done) {
    var corpusID = server.findOrCreateCorpus("Testing", "-1");
    corpusID.then(function(id) {
        assert.ok(id, "Corpus created");
        done();
    }, onError(assert, done));
};

exports["test create corpus exactly once"] = function(assert, done) {
    var name = "Testing2",
        externalID = "-2";

    server.findOrCreateCorpus(name, externalID).then(function(id1) {
        return server.findOrCreateCorpus(name, externalID).then(function(id2) {
            assert.equal(id1, id2, "Corpus is only created once");
            done();
        }, onError(assert, done));
    }, onError(assert, done));
};

exports["test add item to corpus"] = function(assert, done) {
    var corpusID = server.findOrCreateCorpus("Testing", "-1");
    var send = server.sendItemToServer(corpusID, fakeItem);
    send.then(function(result) {
        assert.ok(result, "Item created");
        done();
    }, onError(assert, done)).then(null, onError(assert, done));
};

exports["test add item to corpus"] = function(assert, done) {
    var corpusID = server.findOrCreateCorpus("Testing", "-1");
    var send = server.sendItemToServer(corpusID, fakeItem);
    send.then(function(result) {
        assert.ok(result, "Item created");
        assert.equal(result.statusText, "Created", "Item was created");
        done();
    }, onError(assert, done)).then(null, onError(assert, done));
};

exports["test add item only once"] = function(assert, done) {
    var corpusID = server.findOrCreateCorpus("Testing", "-1");
    var send = server.sendItemToServer(corpusID, fakeItem);
    send.then(function(result) {
        assert.ok(result, "Item created");
        assert.equal(result.statusText, "OK", "Item already existed");
        done();
    }, onError(assert, done)).then(null, onError(assert, done));
};

exports["test update item if newer"] = function(assert, done) {
    var corpusID = server.findOrCreateCorpus("Testing", "-1");
    var send = server.sendItemToServer(corpusID, fakeItemOlder);
    send.then(function(result) {
        assert.ok(result, "Item sent");
        assert.equal(result.statusText, "OK", "Item existed");
        assert.equal(result.message, "updated", "Item was altered");
        done();
    }, onError(assert, done)).then(null, onError(assert, done));
};

before(exports, function() {
    server.getExistingCorpora(); // ensures server is running
});

require("sdk/test").run(exports);