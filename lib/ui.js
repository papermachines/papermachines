"use strict";

var utils = require("./utils");
var zotero_utils = require("./zotero");

var logger = new utils.Logger(zotero_utils.getZotero());

exports.addButtonToDocument = addButtonToDocument;
exports.removeButtonFromDocument = removeButtonFromDocument;

function handleClick() {
    logger.info("Exporting current group.");
    zotero_utils.exportCurrentItemGroup();
}

function makeToolbarButton(doc) {
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var button = doc.createElementNS(XUL_NS, "toolbarbutton");
    button.setAttribute("id", "papermachines-button");
    button.setAttribute("class", "zotero-tb-button");
    button.setAttribute("tooltiptext", "Process selected collection with Paper Machines");
    button.addEventListener("command", handleClick, false);
    return button;
}

function addButtonToDocument(doc) {
    if (!doc.getElementById("papermachines-button")) {
        var toolbar = doc.getElementById("zotero-collections-toolbar");
        if (!toolbar) return;
        var button = makeToolbarButton(doc);
        toolbar.insertBefore(button, toolbar.lastChild.previousSibling);
    }
}

function removeButtonFromDocument(doc) {
    var button = doc.getElementById("papermachines-button");
    button.parentNode.removeChild(button);
}