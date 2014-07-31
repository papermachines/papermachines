"use strict";
var main = require("./main");
var utils = require("./utils");
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

before(exports, function(name, assert) {
    var window = utils.getWindow();
    window.ZoteroPane.show();
    main.onPageLoad();
});

require("sdk/test").run(exports);