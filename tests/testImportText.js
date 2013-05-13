var { assert, expect } = require("assertions");
var widgets = require("widgets");
var tabs = require("tabs");
var modal = require("modal-dialog");
var pm = require("pm");
var prefs = require("prefs");

var setupModule = function(module) {
	module.controller = mozmill.getBrowserController();
	tabBrowser = new tabs.tabBrowser(controller);
	tabBrowser.closeAllTabs();
}

var setupTest = function() {
	controller.open("zotero://select");
	if (controller.window.ZoteroOverlay)
		controller.window.ZoteroOverlay.toggleTab();
	controller.waitForPageLoad();
	tabBrowser.closeAllTabs();
};

var testImportText = function () {
	controller.open("zotero://select");

	controller.window.Zotero.Schema.updateBundledFiles("translators");

	var rdf_translator;
	assert.waitFor(function () {
		rdf_translator = controller.window.Zotero.getTranslatorsDirectory();
		rdf_translator.append("RDF.js");
		return rdf_translator.exists();
	}, "RDF translator not found", 60000, 1000);

	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	controller.window.Zotero_File_Interface.importFile(new FileUtils.File("/Users/chrisjr/mozmill/_testcollection/_testcollection.rdf"));

	// check for unresponsive script indicator to turn back on
	assert.waitFor(function () {
		return prefs.preferences.getPref("dom.max_chrome_script_run_time", 0) > 0;
	});
};