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

var testPhrasenetCustom = function(){
	pm.svgExpectedTester(controller, tabBrowser, "phrasenet-custom", function () {
		var myController = new mozmill.controller.MozMillController(mozmill.utils.getWindowByTitle("Paper Machines"));
		// var okButton = new elementslib.Lookup(myController.window.document,
		// 	'/id("zotero-papermachines-container")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}');
		var okButton = new elementslib.XPath(myController.window.document, "/*[name()='dialog']/*[name()='vbox'][1]/*[name()='hbox'][1]/*[name()='button'][2]");
		myController.click(okButton);		
	});
};