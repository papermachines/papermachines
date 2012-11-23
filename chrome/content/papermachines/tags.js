Zotero_PaperMachines_TagSelector = function () {};

logger = function(msg) {
      var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
         .getService(Components.interfaces.nsIConsoleService);
      consoleService.logStringMessage(msg);
};

Zotero_PaperMachines_TagSelector.init = function () {
	var container = document.getElementById("zotero-papermachines-tagselector-container");
	
	this.io = window.arguments[0];

    var intro = document.getElementById("zotero-papermachines-tagselector-intro");
    var vbox = document.getElementById("zotero-papermachines-tagselector-vbox");

    this.selection = {};

    var me = this;

    intro.setAttribute('value', this.io.dataIn.intro);
    logger(this.io.dataIn.items);

    this.io.dataIn.items.forEach(function (item) {
	    var label = document.createElement('label');
	    label.setAttribute('value', item.name);
		label.className = 'zotero-clicky';
	    label.setAttribute('tagID', item.tagID);
		label.addEventListener('click', function(event) { me.handleTagClick(event, label) }, false);
	    vbox.appendChild(label);
    });
};

Zotero_PaperMachines_TagSelector.handleTagClick = function (event, label) {
	if (label.getAttribute('selected')=='true'){
		delete this.selection[label.getAttribute('tagID')];
		label.setAttribute('selected', 'false');
	} else {
		this.selection[label.getAttribute('tagID')] = label.value;
		label.setAttribute('selected', 'true');
	}
};

Zotero_PaperMachines_TagSelector.acceptSelection = function() {
    this.io.dataOut = this.selection;
	return true;
};