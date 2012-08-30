Zotero_PaperMachines_Dialog = function () {};

Zotero_PaperMachines_Dialog.init = function () {

	var container = document.getElementById("zotero-papermachines-container");
	
	this.io = window.arguments[0];

	var list = document.getElementById("zotero-papermachines-list");
    document.getElementById("zotero-papermachines-intro").label = this.io.dataIn["prompt"];

	this.io.dataIn["options"].forEach(function (item) {
        var row = document.createElement('listitem');
        var cell = document.createElement('listcell');
        cell.setAttribute('label', item.name);
        row.appendChild(cell);

        cell = document.createElement('listcell');
        cell.setAttribute('label', item.label );
        row.appendChild(cell);

        row.setUserData("value", item.value, null);
        list.appendChild(row);
    });
};

Zotero_PaperMachines_Dialog.acceptSelection = function() {
	var list = document.getElementById("zotero-papermachines-list");
	this.io.dataOut = list.selectedItem.getUserData("value");

	return true;
};