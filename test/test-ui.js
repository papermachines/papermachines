"use strict";
var main = require("./main");
var utils = require("./utils");
var ui = require("./ui");
var before = require("sdk/test/utils").before;

function checkForButton(window, assert, done) {
    var i = 0,
        millis = 100,
        maxRetries = 10,
        interval = window.setInterval(function() {
            if (window.document.getElementById("papermachines-button") !== null) {
                assert.pass("button exists in toolbar");
                window.clearInterval(interval);
                done();
            }
            i++;
            if (i == maxRetries) {
                window.clearInterval(interval);
                assert.fail("did not find button in " + (maxRetries * millis) + " ms.");
                done();
            }
        }, millis);
}

exports["test main button added async"] = function(assert, done) {
    var window = utils.getWindow();
    checkForButton(window, assert, done);
};

exports["test main button added toggleTab async"] = function(assert, done) {
    var window = utils.getWindow();
    window.ZoteroPane.toggleTab();
    checkForButton(window, assert, done);
};

exports["test main button added toggleTabTwice async"] = function(assert, done) {
    var window = utils.getWindow();
    window.ZoteroPane.toggleTab();
    window.ZoteroPane.toggleTab();
    checkForButton(window, assert, done);
};


exports["test button removed"] = function(assert, done) {
    var window = utils.getWindow();
    try {
        ui.removeButtonFromDocument(window.ZoteroPane.document);        
    } catch (e) {
        console.error(e);
        assert.fail("button could not be removed");
    }
    assert.ok(window.document.getElementById("papermachines-button") == null, "Button removed");
    done();
};


before(exports, function(name, assert) {
    var window = utils.getWindow();
    window.ZoteroPane.show();
    main.onPageLoad();
});

require("sdk/test").run(exports);