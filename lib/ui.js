"use strict";

var zotero_utils = require("./zotero");

exports.addButtonToDocument = addButtonToDocument;

function handleClick() {
    console.log("Exporting current group.");
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