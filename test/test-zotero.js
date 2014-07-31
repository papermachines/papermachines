"use strict";

var zotero_utils = require("./zotero");
var waitUntil = require("sdk/test/utils").waitUntil;

exports["test zotero prepare item for export"] = function(assert, done) {
    var Zotero = zotero_utils.getZotero(),
        item,
        i = 1;
    waitUntil(function() { // find the first valid item
        item = Zotero.Items.get(i++);
        return !!item;
    }).then(function() {
        var to_export = zotero_utils.prepareItemForExport(item);

        assert.ok(to_export, "Item prepared for export");
        done();
    });
};

exports["test zotero traverse collection"] = function(assert, done) {
    var Zotero = zotero_utils.getZotero(),
        itemGroup,
        i = 1;
    waitUntil(function() {
        itemGroup = Zotero.Collections.get(i++);
        return !!itemGroup;
    }).then(function() {
        var itemGroups = zotero_utils.traverseItemGroup(itemGroup);

        assert.equal(itemGroups.length, 1, "regular collection yields 1 group");
        done();
    });
};

exports["test zotero traverse main library"] = function(assert) {
    var library = zotero_utils.getLibrary(),
        itemGroups = zotero_utils.traverseItemGroup(library);
    assert.equal(itemGroups.length, 21, "entire library yields 21 groups (20 newsgroups + 1 saved search)");
};

require("sdk/test").run(exports);