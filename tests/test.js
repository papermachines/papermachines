var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
  controller.click(new elementslib.ID(controller.window.document, "zotero-addon-bar-icon"));
}

var testFoo = function(){
}