"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var obs = Services.obs;
var ui = require("./ui");
var utils = require("./utils");

var logger = new utils.Logger();
logger.info("Paper Machines initializing");

exports.onPageLoad = onPageLoad;

function onPageLoad() {
    logger.info("onPageLoad");
    var window = utils.getWindow();
    if (window.ZoteroOverlay) {
        var tab = window.ZoteroOverlay.findZoteroTab();
        if (tab) {
            if (window.gBrowser) {
                ui.addButtonToDocument(window.gBrowser.getBrowserForTab(tab).contentDocument);
            } else {
                ui.addButtonToDocument(window.ZoteroPane.document);
            }
        } else {
            ui.addButtonToDocument(window.ZoteroPane.document);
        }
    } else if (window.Zotero) { // in Zotero Standalone
        var ZoteroPane = window.Zotero.getActiveZoteroPane();
        ui.addButtonToDocument(ZoteroPane.document);
    } else {
        logger.error("ZoteroPane not found!");
    }
}

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

// tripling up here on the load event handler; seems all are needed
// to ensure button is added both in tab and pane mode

var observer = new ChromeCreatedObserver();

utils.getWindow().addEventListener("load", onPageLoad, false);

onPageLoad();