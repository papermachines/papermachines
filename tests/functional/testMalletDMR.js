var widgets = require("../widgets");
var tabs = require("../tabs");
var modal = require("../modal-dialog");
var pm = require("../pm");

var setupModule = function(module) {
	module.controller = mozmill.getBrowserController();
	tabBrowser = new tabs.tabBrowser(controller);
	pm.pm_Setup_Module(module, controller);
}

var setupTest = function() {
	pm.pm_Setup_Test(controller);
};

var testMalletDMR = function() {
	pm.svgExpectedTester(controller, tabBrowser, "mallet_dmr", function () {
		var myController = new mozmill.controller.MozMillController(mozmill.utils.getWindowByTitle("Paper Machines"));
		var okButton = new elementslib.Lookup(myController.window.document,
			'/id("zotero-papermachines-advanced")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}');
		myController.click(okButton);		
	});
};