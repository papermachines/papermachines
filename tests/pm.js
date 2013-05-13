var { assert, expect } = require("assertions");
var widgets = require("widgets");
var tabs = require("tabs");
var modal = require("modal-dialog");
var prefs = require("prefs");

function pm_Setup_Module(module, controller) {
	tabBrowser = new tabs.tabBrowser(controller);
	tabBrowser.closeAllTabs();
}

function pm_Setup_Test(controller, n) {
	controller.open("zotero://select");
	var tree = findElement.XPath(controller.tabs.activeTab, ".//*[@id='zotero-collections-tree']");
	tree.waitForElement(20000);
	widgets.clickTreeCell(controller, tree, n !== undefined ? n : 1, 0, {});
}

function acceptDialog(controller) {
	var okButton = findElement.XPath(controller.window.document,
		"//*[@dlgtype='accept']");
	okButton.click();
}

function acceptAdvancedDialog(controller) {
	var okButton = findElement.Lookup(controller.window.document,
		'/id("zotero-papermachines-advanced")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}');
	okButton.click();
}

function svgExpectedTester(controller, tabBrowser, processMenuItemID, modalCallback) {
	var menuitem = findElement.ID(controller.window.document, processMenuItemID);
	if (modalCallback) {
		var md = new modal.modalDialog(controller.window);
		md.start(modalCallback);

		menuitem.click();

		md.waitForDialog();
	} else {
		menuitem.click();
	}
	var svg = findElement.XPath(controller.tabs.activeTab, ".//html//body//*[name()='svg']");
	svg.waitForElement(60000, 3000);
	controller.screenshot(svg, processMenuItemID, true);
	tabBrowser.closeTab();
}

function gmapsExpectedTester(controller, tabBrowser, processMenuItemID) {
	var menuitem = findElement.ID(controller.window.document, processMenuItemID);
	menuitem.click();
	var map = findElement.XPath(controller.tabs.activeTab, ".//html//body//div[@id='heatmapArea']");
	map.waitForElement(60000, 3000);
	controller.screenshot(map, processMenuItemID, true);
	tabBrowser.closeTab();
}

function waitForNewTab(controller) {
    var self = { opened: false };
    function checkTabOpened() { self.opened = true; }
    controller.window.addEventListener("TabOpen", checkTabOpened, false);
    try {
      assert.waitFor(function () {
        return self.opened;
      }, "Link has been opened in a new tab", 60000, 1000);
    } finally {
      controller.window.removeEventListener("TabOpen", checkTabOpened, false);
    }
}
exports.pm_Setup_Module = pm_Setup_Module;
exports.pm_Setup_Test = pm_Setup_Test;
exports.svgExpectedTester = svgExpectedTester;
exports.gmapsExpectedTester = gmapsExpectedTester;
exports.waitForNewTab = waitForNewTab;
exports.acceptDialog = acceptDialog;
exports.acceptAdvancedDialog = acceptAdvancedDialog;