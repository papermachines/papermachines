"use strict";

var window_utils = require("sdk/window/utils");

exports.getWindow = getWindow;
exports.Queue = Queue;

function getWindow() {
    return window_utils.getMostRecentBrowserWindow();
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
                    console.error(e);
                }
                if (typeof my.after == "function") my.after();
            } else {
                if (typeof my.onDone == "function") my.onDone();
            }
        }, 0);
    }
};