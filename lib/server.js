"use strict";

let {
    defer, resolve
} = require("sdk/core/promise");

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
    let {
        promise, resolve
    } = defer();
    utils.getWindow().setTimeout(resolve, ms, value);
    return promise;
}

function timeout(promise, ms) {
    let deferred = defer();
    promise.then(deferred.resolve, deferred.reject);
    delay(ms, "timeout").then(deferred.reject);
    return deferred.promise;
}

function getCorporaEndpoint() {
    return serverURL + "/corpora";
}

function getCorpusTextsEndpoint(corpusID) {
    return getCorporaEndpoint() + "/" + corpusID + "/texts";
}

function getJSON(url, timeoutDuration) {
    timeoutDuration = timeoutDuration || defaultTimeout;
    var deferred = defer();
    new Request({
        url: url,
        headers: {
            "Accept": "application/json"
        },
        onComplete: function(response) {
            var json = response.json;
            if (json) {
                json.statusText = response.statusText;
                deferred.resolve(json);
            } else {
                deferred.reject(response);
            }
        }
    }).get();
    return timeout(deferred.promise, timeoutDuration);
}

function postJSON(url, jsonObj, timeoutDuration) {
    timeoutDuration = timeoutDuration || defaultTimeout;
    var deferred = defer();
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
                deferred.resolve(json);
            } else {
                deferred.reject(response);
            }
        }
    }).post();
    return timeout(deferred.promise, timeoutDuration);
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
    return resolve(corpusID)
        .then(doSend, onError);
}

function getExistingCorpora() {
    return getJSON(getCorporaEndpoint());
}