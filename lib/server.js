"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Promise.jsm");

var utils = require("./utils");

var logger = new utils.Logger();

var defaultTimeout = 10000; //ms

exports.getJSON = getJSON;
exports.postJSON = postJSON;
exports.getCorporaEndpoint = getCorporaEndpoint;
exports.getExistingCorpora = getExistingCorpora;
exports.findOrCreateCorpus = findOrCreateCorpus;
exports.sendItemToServer = sendItemToServer;

var serverURL = "http://127.0.0.1:9000";

function onError(error) {
    logger.error(error);
}

function delay(ms, message) {
    return new Promise(function(resolve, reject) {
        utils.getWindow().setTimeout(resolve, ms, message);
    });
}

function timeout(promise, ms, message) {
    message = message || "timeout";
    return new Promise(function(resolve, reject) {
        promise.then(resolve, reject);
        delay(ms, message).then(reject);
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
    var Zotero = utils.getWindow().Zotero;
    var label = requestType + " " + url;

    var options = {"responseType": "json", "headers": {"Accept": "application/json"}};
    if (requestType == "POST") {
        options.headers["Content-Type"] = "application/json";
        options.body = content;
    }

    return timeout(Zotero.HTTP.promise(requestType, url, options).then(function(xhr) {
        var json = xhr.response;
        if (json) {
            json.statusText = xhr.statusText;
            return json;
        }
    }), timeoutDuration, label + " timed out.");
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
        });
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