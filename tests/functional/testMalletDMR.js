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
	pm.svgExpectedTester(controller, tabBrowser, "mallet_dmr", pm.acceptAdvancedDialog);
};