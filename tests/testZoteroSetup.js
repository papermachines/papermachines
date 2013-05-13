var { assert, expect } = require("assertions");
var widgets = require("widgets");
var tabs = require("tabs");
var utils = require("utils");
var domutils = require("dom-utils");

var setupModule = function(module) {
};

var setupTest = function () {
};

var testZoteroSetup = function () {
	utils.handleWindow("title", "Existing Zotero Library Found", function (controller) {
		var noButton = findElement.Lookup(controller.window.document, 
			'/id("commonDialog")/anon({"anonid":"buttons"})/{"dlgtype":"cancel"}');
		noButton.click();
	});
};