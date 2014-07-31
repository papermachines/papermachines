"use strict";
var utils = require("./utils");

exports["test queue"] = function(assert, done) {
    var i = 0;
    var queue = new utils.Queue({
        after: function() {
            queue.next();
        },
        onDone: function() {
            assert.equal(i, 3, "Fired three times");
            done();
        }
    });
    var inc = function() {
        i += 1;
    };

    queue.add(inc);
    queue.add(inc);
    queue.add(inc);
    queue.next();
};

require("sdk/test").run(exports);