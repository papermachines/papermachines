"use strict";

var events = require("sdk/system/events");
var ui = require("./ui");
var utils = require("./utils");

exports.onPageLoad = onPageLoad;

function onPageLoad() {
    var window = utils.getWindow();
    if (window.ZoteroOverlay) {
        var tab = window.ZoteroOverlay.findZoteroTab();
        if (tab) {
            ui.addButtonToDocument(window.gBrowser.getBrowserForTab(tab).contentDocument);
        } else {
            ui.addButtonToDocument(window.ZoteroPane.document);
        }
    }
}

function chromeCreated(event) {
    var window = event.subject;
    window.addEventListener("load", onPageLoad, true);
}

// doubling up here on the load event handler, but both are needed
// to ensure button is added both in tab and pane mode

var container = utils.getWindow().gBrowser.tabContainer;
container.addEventListener("TabSelect", onPageLoad, false);

events.on("chrome-document-global-created", chromeCreated);