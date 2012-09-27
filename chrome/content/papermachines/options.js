Components.utils.import("chrome://papermachines/content/Preferences.js");

Zotero_PaperMachines_Options = function () {};

Zotero_PaperMachines_Options.resetPrefsForPane = function (pane) {
	var paneBranch = "extensions.papermachines." + pane + ".";
	Preferences.resetBranch(paneBranch);
};