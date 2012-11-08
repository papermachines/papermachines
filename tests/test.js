var widgets = require("widgets");
var tabs = require("tabs");
var modal = require("modal-dialog");

//var controller = mozmill.getBrowserController();

var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
//  tabs.closeAllTabs();
  tabBrowser = new tabs.tabBrowser(controller);
  controller.open("zotero://select");
}

var setupTest = function(test) {
	var tree = new elementslib.XPath(controller.tabs.activeTab, ".//*[@id='zotero-collections-tree']");
	controller.waitForElement(tree, 20000);
	widgets.clickTreeCell(controller, tree, 1, 0, {});
};

var teardownTest = function(test) {
};

function svgExpectedTester(processMenuItemID, modalCallback) {
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
};

var testExtractText = function () {
	var menuitem = new elementslib.ID(controller.window.document, "extract_text");
	controller.click(menuitem)
};

var testWordCloudLarge = function(){
	svgExpectedTester("wordcloud_large");
};

var testWordCloudLargeTfIdf = function(){
	svgExpectedTester("wordcloud_large_tfidf");
};

var testPhrasenet = function(){
	svgExpectedTester("phrasenet-x_and_y");
};

var testPhrasenetCustom = function(){
	svgExpectedTester("phrasenet-custom", function () {
		var myController = new mozmill.controller.MozMillController(mozmill.utils.getWindowByTitle("Paper Machines"));
		// var okButton = new elementslib.Lookup(myController.window.document,
		// 	'/id("zotero-papermachines-container")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}');
		var okButton = new elementslib.XPath(myController.window.document, "/*[name()='dialog']/*[name()='vbox'][1]/*[name()='hbox'][1]/*[name()='button'][2]");
		myController.click(okButton);		
	});
};

// var testGeoparserFlightPaths = function() {
// 	svgExpectedTester("geoparser_flightpaths");
// };

var testMalletLDA = function() {
	svgExpectedTester("mallet_lda", function () {
		var myController = new mozmill.controller.MozMillController(mozmill.utils.getWindowByTitle("Paper Machines"));
		var okButton = new elementslib.Lookup(myController.window.document,
			'/id("zotero-papermachines-advanced")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}');
		myController.click(okButton);		
	});
};