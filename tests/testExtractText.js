var { assert, expect } = require("assertions");
var pm = require("pm");

var setupModule = function(module) {
	module.controller = mozmill.getBrowserController();
	pm.pm_Setup_Module(module, controller);
}

var setupTest = function() {
	pm.pm_Setup_Test(controller);
};

var testExtractText = function () {
	Components.utils.import("resource://gre/modules/FileUtils.jsm");

	var dir = controller.window.Zotero.getZoteroDirectory();
	var pdfToText = new FileUtils.File("/Users/chrisjr/mozmill/pdftotext-MacIntel");
	pdfToText.copyTo(dir, null);

	var menuitem = findElement.ID(controller.window.document, "extract_text");
	menuitem.click();
	pm.waitForNewTab(controller);
	assert.waitFor(function () {
		var tab = controller.tabs.activeTab;
		if (tab && tab.body && tab.body.textContent) {
			return !!tab.body.textContent.match(/closed/);
		}
		return false;
	}, "Extraction complete", 60000, 2000);
};