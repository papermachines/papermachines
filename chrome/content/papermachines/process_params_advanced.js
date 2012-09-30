Zotero_PaperMachines_ProcessParams_Advanced = function () {};

logger = function(msg) {
      var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
         .getService(Components.interfaces.nsIConsoleService);
      consoleService.logStringMessage(msg);
};

Zotero_PaperMachines_ProcessParams_Advanced.init = function () {

	var container = document.getElementById("zotero-papermachines-adv-params-container");
	
	this.io = window.arguments[0];

    var intro = document.getElementById("zotero-papermachines-adv-params-intro");
    var vbox1 = document.getElementById("zotero-papermachines-adv-params-vbox");
    var vbox2 = document.getElementById("zotero-papermachines-adv-params-vbox-extra");

    intro.setAttribute('value', this.io.dataIn.intro);

    this.io.dataIn.items.forEach(function (item) {
        var obj, vbox;
        if (!("advanced" in item)) {
            vbox = vbox1;            
        } else {
            vbox = vbox2;  
        }

        switch (item.type) {
            case "text":
                var myVbox = document.createElement('vbox');
                var label = document.createElement('label');
                obj = document.createElement('textbox');
                obj.setAttribute('label', item.label);
                obj.setAttribute('value', item.value);
                label.setAttribute('value', item.label);
                myVbox.appendChild(label);
                myVbox.appendChild(obj);       
                myVbox.setUserData('name', item.name, null);
                myVbox.setUserData('type', item.type, null);
                vbox.appendChild(myVbox);
                break;
            case "check":
                obj = document.createElement('checkbox');
                obj.setAttribute('label', item.label);
                obj.setUserData('type', item.type, null);
                obj.setUserData('name', item.name, null);
                obj.setAttribute('checked', item.value);
                vbox.appendChild(obj);
                break;
        }
    });
};

Zotero_PaperMachines_ProcessParams_Advanced.disclose = function() {
    var vbox2 = document.getElementById("zotero-papermachines-adv-params-vbox-extra");
    vbox2.hidden = !vbox2.hidden;
};

Zotero_PaperMachines_ProcessParams_Advanced.acceptSelection = function() {
    this.io.dataOut = {};

    var vbox1 = document.getElementById("zotero-papermachines-adv-params-vbox");
    var vbox2 = document.getElementById("zotero-papermachines-adv-params-vbox-extra");
    [vbox1, vbox2].forEach(function (vbox) {
        while (vbox.hasChildNodes()) {
            var obj = vbox.childNodes[0];
            var name = obj.getUserData("name");
            var type = obj.getUserData("type");

            if (name != null) {
                if (type == "check") {
                    this.io.dataOut[name] = obj.checked;
                } else {
                    this.io.dataOut[name] = obj.childNodes[1].value;
                }
            }
            vbox.removeChild(obj);
        }
    });

    for (var i in this.io.dataOut) {
        logger(i + ": " + this.io.dataOut[i]);
    }

	return true;
};