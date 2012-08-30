Zotero_PaperMachines_Dialog = function () {};

Zotero_PaperMachines_Dialog.init = function () {

	var container = document.getElementById("zotero-papermachines-container");
	
	this.io = window.arguments[0];

    var intro = document.getElementById("zotero-papermachines-intro");
    var description = document.getElementById("zotero-papermachines-confirm-intro");
    var textbox = document.getElementById("zotero-papermachines-textbox");
    var list = document.getElementById("zotero-papermachines-list");

    switch (this.io.dataIn["type"]) {
        case "yes-no":
            description.hidden = false;
            var desc_div = document.createElementNS("http://www.w3.org/1999/xhtml","div");
            desc_div.innerHTML = this.io.dataIn["prompt"];
            description.appendChild(desc_div);
            break;
        case "text":
            textbox.hidden = false;
            break;
        case "multiple":
            list.selType = "multiple";
        case "select":
        default:
            intro.hidden = false;
            intro.label = this.io.dataIn["prompt"];
            list.hidden = false;

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
            break;
    }
};

Zotero_PaperMachines_Dialog.acceptSelection = function() {
    switch (this.io.dataIn["type"]) {
        case "yes-no":
            this.io.dataOut = true;
            break;
        case "text":
            this.io.dataOut = document.getElementById("zotero-papermachines-textbox").value;
        case "multiple":
            var list = document.getElementById("zotero-papermachines-list");
            this.io.dataOut = [];
            list.selectedItems.forEach(function (item) {
                this.io.dataOut.push(item.getUserData("value"));                
            });
        case "select":
        default:
            var list = document.getElementById("zotero-papermachines-list");
            this.io.dataOut = list.selectedItem.getUserData("value");
            break;
    }
	return true;
};