"use strict";

exports.getZotero = getZotero;
exports.getZoteroPane = getZoteroPane;
exports.getLibrary = getLibrary;
exports.exportCurrentItemGroup = exportCurrentItemGroup;
exports.prepareItemForExport = prepareItemForExport;
exports.traverseItemGroup = traverseItemGroup;

var utils = require("./utils");
var server = require("./server");

var Zotero = utils.getWindow().Zotero;
var logger = new utils.Logger(Zotero);

function getZotero() {
    return Zotero;
}

function getZoteroPane() {
    var window = utils.getWindow();
    if (!window.ZoteroPane) throw new Error("ZoteroPane is undefined!");
    if (!window.ZoteroPane.loaded) {
        try {
            window.ZoteroPane.show();
        } catch (e) {
            throw new Error("ZoteroPane is not loaded!");
        }
    }
    return window.ZoteroPane;
}

function getLibrary() {
    return new Zotero.ItemGroup("library", {
        libraryID: null
    });
}

function getChildItems(itemGroup) {
    if (typeof itemGroup.getItems == "function") {
        return itemGroup.getItems();
    } else if (typeof itemGroup.getChildItems == "function") {
        return itemGroup.getChildItems();
    }
}

function getItemGroupID(itemGroup) {
    if (itemGroup === null || itemGroup === undefined) return null;
    if (typeof itemGroup.isCollection === "function" && itemGroup.isCollection()) {
        if (itemGroup.hasOwnProperty("ref")) {
            return (itemGroup.ref.libraryID !== null ? itemGroup.ref.libraryID.toString() : "") + "C" + itemGroup.ref.id.toString();
        } else {
            return (itemGroup.libraryID !== null ? itemGroup.libraryID.toString() : "") + "C" + itemGroup.id.toString();
        }
    } else if (typeof itemGroup.isGroup === "function" && itemGroup.isGroup()) {
        return itemGroup.ref.libraryID;
    } else { // e.g. isSearch
        return itemGroup.id;
    }
}

function getGroupName(itemGroup) {
    if (typeof itemGroup.getName == "function") {
        return itemGroup.getName();
    } else if (itemGroup.name) {
        return itemGroup.name;
    } else {
        return "";
    }
}

function traverseItemGroup(itemGroup) {
    var itemGroups = [],
        children;

    if (typeof itemGroup.isLibrary == "function" && itemGroup.isLibrary()) {
        if (itemGroup.id == "L") {
            itemGroups.push(getLibrary());
            var collectionKeys = Zotero.DB.columnQuery("SELECT key from collections WHERE libraryID IS NULL;");
            if (collectionKeys) {
                // place collections first; that way, documents will be marked with the collection they're in, not the overall library
                itemGroups = collectionKeys.map(function(d) {
                    return Zotero.Collections.getByLibraryAndKey(null, d);
                }).concat(itemGroups);
            }
        }
    } else {
        if (typeof itemGroup.isCollection == "function" && itemGroup.isCollection()) {
            var thisCollection = ("ref" in itemGroup) ? itemGroup.ref : itemGroup;
            itemGroups.push(thisCollection);
            if (thisCollection.hasChildCollections()) {
                children = thisCollection.getChildCollections();
            }
        } else if (typeof itemGroup.isGroup == "function" && itemGroup.isGroup()) {
            if (itemGroup.ref.hasCollections()) {
                children = itemGroup.ref.getCollections();
            }
        }

        if (children) {
            children.forEach(function(child) {
                Array.prototype.push.apply(itemGroups, traverseItemGroup(child));
            });
        }
    }
    return itemGroups;
}

function prepareItemForExport(item, groupName) {
    var obj = Zotero.Utilities.itemToCSLJSON(item),
        attachmentID = item.getBestAttachment(),
        attachment;
    if (!attachmentID) return false;

    attachment = Zotero.Items.get(attachmentID);
    obj["library-key"] = item.libraryKey;
    obj["file-url"] = attachment.getLocalFileURL();
    obj["last-modified"] = Zotero.Date.sqlToDate(item.dateModified);
    obj.label = groupName;
    return obj;
}

function findOrCreateCorpusID(itemGroup) {
    var name = getGroupName(itemGroup),
        externalID = getItemGroupID(itemGroup);
    return server.findOrCreateCorpus(name, externalID);
}

function exportCurrentItemGroup() {
    var ZoteroPane = getZoteroPane(),
        thisGroup = ZoteroPane.getItemGroup(),
        corpusID = findOrCreateCorpusID(thisGroup);

    corpusID.then(function(id) {
        traverseAndExportItemGroup(thisGroup, id);
    }, function(error) {
        logger.error(error);
        logger.error("Corpus ID could not be acquired. Is the server running?");
    });
}

function traverseAndExportItemGroup(itemGroup, corpusID) {
    var itemGroups = traverseItemGroup(itemGroup);

    logger.info(itemGroups.map(function(d) {
        return getGroupName(d);
    }));

    Zotero.UnresponsiveScriptIndicator.disable();
    Zotero.showZoteroPaneProgressMeter("Extracting files");

    var queue = new utils.Queue({
        after: function() {
            queue.completed += 1;
            try {
                Zotero.updateZoteroPaneProgressMeter(queue.completed * 100.0 / queue.total);
            } catch (e) {
                logger.error(e);
            }
            queue.next();
        },
        onDone: function() {
            Zotero.UnresponsiveScriptIndicator.enable();
            Zotero.hideZoteroPaneOverlay();
        }
    });

    function queueExport(itemGroup) {
        var groupName = getGroupName(itemGroup),
            items = getChildItems(itemGroup).filter(function(d) {
                return d.isRegularItem();
            });

        logger.info("Queueing export of " + groupName + ": " + items.length + " items");

        items.forEach(function(item) {
            queue.add(function() {
                var jsonItem = prepareItemForExport(item, groupName);
                server.sendItemToServer(corpusID, jsonItem);
            });
        });
    }

    try {
        itemGroups.forEach(queueExport);
    } catch (e) {
        logger.error(e);
    }
    queue.next();
}