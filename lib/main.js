"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var obs = Services.obs;
var ui = require("./ui");
var utils = require("./utils");

var logger = new utils.Logger();
logger.info("Paper Machines initializing");

exports.onPageLoad = onPageLoad;
exports.onUnload = onUnload;

function onPageLoad() {
    logger.info("onPageLoad");
    var window = utils.getWindow();
    if (window && window.Zotero) {
        try {
            var ZoteroPane = window.Zotero.getActiveZoteroPane();
            ui.addButtonToDocument(ZoteroPane.document);
        } catch (e) {
            logger.error("Button add failed");
            logger.error(e);
        }
    } else {
        logger.error("Zotero not found!");
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

function onUnload() {
    var window = utils.getWindow();
    if (window) {
        window.removeEventListener("load", onPageLoad, false);
    }

    if (window && window.Zotero) {
        var ZoteroPane = window.Zotero.getActiveZoteroPane();
        if (ZoteroPane) ui.removeButtonFromDocument(ZoteroPane.document);
    }
    observer.unregister();
}