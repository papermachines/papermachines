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

var testWordCloudChronological = function(){
	pm.svgExpectedTester(controller, tabBrowser, "wordcloud_chronological", function (myController) {
		var okButton = findElement.XPath(myController.window.document,
			"//*[@dlgtype='accept']");

		var md2 = new modal.modalDialog(myController.window);
		md2.start(pm.acceptAdvancedDialog);	

		okButton.click();
		md2.waitForDialog();
	});
};