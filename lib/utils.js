"use strict";

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/devtools/Console.jsm");

var wm = Services.wm;

exports.getWindow = getWindow;
exports.Logger = Logger;
exports.Queue = Queue;


var logger = new Logger();

function Logger(Zotero) {
    this.Zotero = Zotero;
}

Logger.prototype = {
    info: function(msg) {
        console.log(msg);
        if (this.Zotero) this.Zotero.debug(msg);
    },
    error: function(msg) {
        console.error(msg);
        if (this.Zotero) this.Zotero.debug(msg);
    }
};

function getWindow() {
    return wm.getMostRecentWindow(null);
}

function Queue(options) {
    options = options || {};
    this.list = [];
    this.before = options.before || null;
    this.after = options.after || null;
    this.onDone = options.onDone || null;
    this.completed = 0;
    this.total = 0;
}

Queue.prototype = {
    add: function() {
        var args = Array.prototype.slice.call(arguments);
        this.list.push(args);
        this.total += 1;
    },
    next: function() {
        var my = this,
            window = getWindow();
        if (typeof my.before == "function") my.before();
        window.setTimeout(function() {
            if (my.list.length > 0) {
                var current = my.list.shift();
                try {
                    (current.shift()).apply(this, current);
                } catch (e) {
                    logger.error(e);
                }
                if (typeof my.after == "function") my.after();
            } else {
                if (typeof my.onDone == "function") my.onDone();
            }
        }, 0);
    }
};