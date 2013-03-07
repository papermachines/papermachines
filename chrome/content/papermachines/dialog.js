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
            intro.hidden = false;
            intro.label = this.io.dataIn["prompt"];
            document.getElementById("zotero-papermachines-textbox").value = this.io.dataIn["default"];
            break;
        case "multiplecheck":
            var checkboxes = document.getElementById("zotero-papermachines-checkboxes");
            checkboxes.hidden = false;
            intro.hidden = false;
            intro.label = this.io.dataIn["prompt"];
            this.io.dataIn["options"].forEach(function (item) {
                var checkbox = document.createElement('checkbox');
                checkbox.setAttribute('label', item.name);
                checkbox.setUserData('value', item.value, null);
                checkboxes.appendChild(checkbox);
            });
            document.getElementById("zotero-papermachines-selectall").hidden = false;
            document.getElementById("zotero-papermachines-deselectall").hidden = false;
            break;
        case "multiple":
            list.selType = "multiple";
        case "select":
        default:
            intro.hidden = false;
            intro.label = this.io.dataIn["prompt"];
            list.hidden = false;

            var idx = 0, selectedIdx = -1;

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
                if ("default" in item) {
                    selectedIdx = idx;
                }

                idx++;
            });

            if (selectedIdx > -1) {
                list.selectedIndex = selectedIdx;                
            }
            break;
    }
};

Zotero_PaperMachines_Dialog.selectAll = function(deselect) {
    var listbox = document.getElementById("zotero-papermachines-checkboxes");
    for (var i=0; i<listbox.childNodes.length; i++){
        listbox.childNodes[i].setAttribute('checked', !deselect);
    }
}

Zotero_PaperMachines_Dialog.acceptSelection = function() {
    switch (this.io.dataIn["type"]) {
        case "yes-no":
            this.io.dataOut = true;
            break;
        case "text":
            this.io.dataOut = [document.getElementById("zotero-papermachines-textbox").value];
            break;
        case "multiplecheck":
            var checkboxes = document.getElementById("zotero-papermachines-checkboxes");
            this.io.dataOut = [];
            while (checkboxes.hasChildNodes()) {
                var item = checkboxes.childNodes[0];
                if (item.getAttribute("checked")) {
                    this.io.dataOut.push(item.getUserData("value"));                    
                }
                checkboxes.removeChild(item);
            }
            break;
        case "multiple":
            var list = document.getElementById("zotero-papermachines-list");
            this.io.dataOut = [];
            list.selectedItems.forEach(function (item) {
                this.io.dataOut.push(item.getUserData("value"));                
            });
            break;
        case "select":
        default:
            var list = document.getElementById("zotero-papermachines-list");
            this.io.dataOut = [list.selectedItem.getUserData("value")];
            break;
    }
	return true;
};