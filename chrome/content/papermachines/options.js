Components.utils.import("chrome://papermachines/content/Preferences.jsm");

Zotero_PaperMachines_resetPrefsForPane = function (pane) {
	var paneBranch = "extensions.papermachines." + pane + ".";
	Preferences.resetBranch(paneBranch);
};