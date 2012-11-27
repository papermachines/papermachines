var widgets = require("widgets");
var tabs = require("tabs");
var modal = require("modal-dialog");

function pm_Setup_Module(module, controller) {
	controller.open("zotero://select");	
}

function pm_Setup_Test(controller) {
	var tree = new elementslib.XPath(controller.tabs.activeTab, ".//*[@id='zotero-collections-tree']");
	controller.waitForElement(tree, 20000);
	widgets.clickTreeCell(controller, tree, 1, 0, {});
}

function svgExpectedTester(controller, tabBrowser, processMenuItemID, modalCallback) {
	var menuitem = new elementslib.ID(controller.window.document, processMenuItemID);
	if (modalCallback) {
		var md = new modal.modalDialog(controller.window);
		md.start(modalCallback);

		controller.click(menuitem);

		md.waitForDialog();
	} else {
		controller.click(menuitem);
	}
	var svg = new elementslib.XPath(controller.tabs.activeTab, ".//html//body//*[name()='svg']");
	controller.waitForElement(svg, 60000, 3000);
	tabBrowser.closeTab();
}

function gmapsExpectedTester(controller, tabBrowser, processMenuItemID) {
	var menuitem = new elementslib.ID(controller.window.document, processMenuItemID);
	controller.click(menuitem);
	var map = new elementslib.XPath(controller.tabs.activeTab, ".//html//body//div[@id='heatmapArea']");
	controller.waitForElement(map, 60000, 3000);
	tabBrowser.closeTab();
}

exports.pm_Setup_Module = pm_Setup_Module;
exports.pm_Setup_Test = pm_Setup_Test;
exports.svgExpectedTester = svgExpectedTester;
exports.gmapsExpectedTester = gmapsExpectedTester;