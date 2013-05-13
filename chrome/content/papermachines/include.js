if (!Zotero.PaperMachines) {
	const pmLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
					.getService(Components.interfaces.mozIJSSubScriptLoader);
	pmLoader.loadSubScript("chrome://papermachines/content/papermachines.js");
	Zotero.PaperMachines.init();
}

Zotero.PaperMachines.createUI();