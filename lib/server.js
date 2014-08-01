"use strict";

const {
    Cu
} = require("chrome");
Cu.import("resource://gre/modules/Promise.jsm");

var utils = require("./utils");
var Request = require("sdk/request").Request;

var defaultTimeout = 10000; //ms

exports.getJSON = getJSON;
exports.postJSON = postJSON;
exports.getCorporaEndpoint = getCorporaEndpoint;
exports.getExistingCorpora = getExistingCorpora;
exports.findOrCreateCorpus = findOrCreateCorpus;
exports.sendItemToServer = sendItemToServer;

var serverURL = "http://127.0.0.1:9000";

function onError(error) {
    console.error(error);
}

function delay(ms, value) {
    return new Promise(function(resolve, reject) {
        utils.getWindow().setTimeout(resolve, ms, value);
    });
}

function timeout(promise, ms) {
    return new Promise(function(resolve, reject) {
        promise.then(resolve, reject);
        delay(ms, "timeout").then(reject);
    });
}

function getCorporaEndpoint() {
    return serverURL + "/corpora";
}

function getCorpusTextsEndpoint(corpusID) {
    return getCorporaEndpoint() + "/" + corpusID + "/texts";
}

function getJSON(url, timeoutDuration) {
    timeoutDuration = timeoutDuration || defaultTimeout;

    return timeout(new Promise(function(resolve, reject) {
        new Request({
            url: url,
            headers: {
                "Accept": "application/json"
            },
            onComplete: function(response) {
                var json = response.json;
                if (json) {
                    json.statusText = response.statusText;
                    resolve(json);
                } else {
                    reject(response);
                }
            }
        }).get();
    }), timeoutDuration);
}

function postJSON(url, jsonObj, timeoutDuration) {
    timeoutDuration = timeoutDuration || defaultTimeout;
    return timeout(new Promise(function(resolve, reject) {
        new Request({
            url: url,
            content: JSON.stringify(jsonObj),
            contentType: "application/json",
            headers: {
                "Accept": "application/json"
            },
            onComplete: function(response) {
                var json = response.json;
                if (json) {
                    json.statusText = response.statusText;
                    resolve(json);
                } else {
                    reject(response);
                }
            }
        }).post();
    }), timeoutDuration);
}

function findOrCreateCorpus(name, externalID) {
    var json = {
        "name": name,
        "externalID": externalID
    };
    return postJSON(getCorporaEndpoint(), json)
        .then(function(data) {
            return data.id;
        }, onError);
}

function sendItemToServer(corpusID, jsonItem) {
    function doSend(corpusID) {
        return postJSON(getCorpusTextsEndpoint(corpusID), jsonItem);
    }
    return Promise.resolve(corpusID)
        .then(doSend, onError);
}

function getExistingCorpora() {
    return getJSON(getCorporaEndpoint());
}