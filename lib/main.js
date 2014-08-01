"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var obs = Services.obs;
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

// doubling up here on the load event handler, but both are needed
// to ensure button is added both in tab and pane mode

var container = utils.getWindow().gBrowser.tabContainer;
container.addEventListener("TabSelect", onPageLoad, false);

function ChromeCreatedObserver() {
    this.register();
}

ChromeCreatedObserver.prototype = {
    observe: function(subject, topic, data) {
        subject.addEventListener("load", onPageLoad, true);
    },
    register: function() {
        obs.addObserver(this, "chrome-document-global-created", false);
    },
    unregister: function () {
        obs.removeObserver(this, "chrome-document-global-created", false);
    }
};

var observer = new ChromeCreatedObserver();