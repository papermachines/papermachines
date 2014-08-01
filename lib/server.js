"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Promise.jsm");

const {XMLHttpRequest} = Services.appShell.hiddenDOMWindow;

var utils = require("./utils");

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

function requestJSON(requestType, url, timeoutDuration, content) {
    timeoutDuration = timeoutDuration || defaultTimeout;
    return timeout(new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(requestType, url, true);
        xhr.setRequestHeader("Accept", "application/json");

        xhr.responseType = "json";

        xhr.onload = function (e) {
            var json = xhr.response;
            if (json) {
                json.statusText = xhr.statusText;
                resolve(json);
            } else {
                reject(response);
            }
        };

        if (requestType == "POST") {
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(content);
        } else {
            xhr.send();
        }
    }), timeoutDuration);
}

function getJSON(url, timeoutDuration) {
    return requestJSON("GET", url, timeoutDuration);
}

function postJSON(url, jsonObj, timeoutDuration) {
    return requestJSON("POST", url, timeoutDuration, JSON.stringify(jsonObj));
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