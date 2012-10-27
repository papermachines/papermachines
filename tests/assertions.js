/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @namespace Defines expect and assert methods to be used for assertions.
 */
var assertions = exports;

// Include required modules
var stack = require("stack");


// Use the frame module of Mozmill to raise non-fatal failures
var mozmillFrame = {};
Cu.import('resource://mozmill/modules/frame.js', mozmillFrame);


/**
 * The Expect class implements non-fatal assertions, and can be used in cases
 * when a failing test shouldn't abort the current test function. That allows
 * to execute multiple tests in a row.
 *
 * @class Base class for non-fatal assertions
 */
function Expect() {
}

// The following deepEquals implementation is from Narwhal under this license:

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
Expect.prototype._deepEqual = function Expect__deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return this._objEquiv(actual, expected);
  }
};

Expect.prototype._objEquiv = function Expect__objEquiv(a, b) {
  if (a == null || a == undefined || b == null || b == undefined)
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;

  function isArguments(object) {
    return Object.prototype.toString.call(object) == '[object Arguments]';
  }

  //~~~I've managed to break Object.keys through screwy arguments passing.
  // Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = Object.keys(a),
        kb = Object.keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!this._deepEqual(a[key], b[key])) return false;
  }
  return true;
};

/**
 * Log a test as failing by adding a fail frame.
 *
 * @private
 * @param {Object} aResult Test result details used for reporting.
 * @param {String} aResult.fileName Name of the file in which the assertion failed.
 * @param {String} aResult.function Function in which the assertion failed.
 * @param {Number} aResult.lineNumber Line number of the file in which the assertion failed.
 * @param {String} aResult.message Message why the assertion failed.
 */
Expect.prototype._logFail = function Expect__logFail(aResult) {
  mozmillFrame.events.fail({fail: aResult});
};

/**
 * Log a test as passing by adding a pass frame.
 *
 * @private
 * @param {Object} aResult Test result details used for reporting.
 * @param {String} aResult.fileName Name of the file in which the assertion failed.
 * @param {String} aResult.function Function in which the assertion failed.
 * @param {Number} aResult.lineNumber Line number of the file in which the assertion failed.
 * @param {String} aResult.message Message why the assertion failed.
 */
Expect.prototype._logPass = function Expect__logPass(aResult) {
  mozmillFrame.events.pass({pass: aResult});
};

/**
 * Test the condition and mark test as passed or failed
 *
 * @private
 * @param {Boolean} aCondition Condition to test.
 * @param {String} [aMessage] Message to show for the test result
 * @param {String} [aDiagnosis] Diagnose message to show for the test result
 * @returns {Boolean} Result of the test.
 */
Expect.prototype._test = function Expect__test(aCondition, aMessage, aDiagnosis) {
  let diagnosis = aDiagnosis || "";
  let message = aMessage || "";

  if (diagnosis)
    message = message ? message + " - " + diagnosis : diagnosis;

  // Build result data
  let frame = stack.findCallerFrame(Components.stack);

  let result = {
    'fileName'   : frame.filename.replace(/(.*)-> /, ""),
    'lineNumber' : frame.lineNumber,
    'message'    : message,
    'name'       : frame.name
  };

  // Log test result
  if (aCondition) {
    this._logPass(result);
  } else {
    result.stack = stack.stripStackInformation(Components.stack);
    this._logFail(result);
  }

  return aCondition;
};

/**
 * Perform an always passing test
 *
 * @param {String} aMessage Message to show for the test result.
 * @returns {Boolean} Always returns true.
 */
Expect.prototype.pass = function Expect_pass(aMessage) {
  return this._test(true, aMessage, undefined);
};

/**
 * Perform an always failing test
 *
 * @param {String} aMessage Message to show for the test result.
 * @returns {Boolean} Always returns false.
 */
Expect.prototype.fail = function Expect_fail(aMessage) {
  return this._test(false, aMessage, undefined);
};

/**
 * Test if the value pass
 *
 * @param {Boolean|String|Number|Object} aValue Value to test.
 * @param {String} aMessage Message to show for the test result.
 * @returns {Boolean} Result of the test.
 */
Expect.prototype.ok = function Expect_ok(aValue, aMessage) {
  let condition = !!aValue;
  let diagnosis = "got '" + aValue + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if both specified values are identical.
 *
 * @param {boolean|string|number|object} aValue
 *   Value to test.
 * @param {boolean|string|number|object} aExpected
 *   Value to strictly compare with.
 * @param {string} aMessage
 *   Message to show for the test result
 * @returns {boolean} Result of the test.
 */
Expect.prototype.equal = function Expect_equal(aValue, aExpected, aMessage) {
  let condition = (aValue === aExpected);
  let diagnosis = "'" + aValue + "' should equal '" + aExpected + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if both specified values are not identical.
 *
 * @param {boolean|string|number|object} aValue
 *   Value to test.
 * @param {boolean|string|number|object} aExpected
 *   Value to strictly compare with.
 * @param {string} aMessage
 *   Message to show for the test result
 * @returns {boolean} Result of the test.
 */
Expect.prototype.notEqual = function Expect_notEqual(aValue, aExpected, aMessage) {
  let condition = (aValue !== aExpected);
  let diagnosis = "'" + aValue + "' should not equal '" + aExpected + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if an object equals another object
 *
 * @param {object} aValue
 *   The object to test.
 * @param {object} aExpected
 *   The object to strictly compare with.
 * @param {string} aMessage
 *   Message to show for the test result
 * @returns {boolean} Result of the test.
 */
Expect.prototype.deepEqual = function equal(aValue, aExpected, aMessage) {
  let condition = this._deepEqual(aValue, aExpected);
  try {
    var aValueString = JSON.stringify(aValue);
  } catch(e) {
    var aValueString = String(aValue);
  }
  try {
    var aExpectedString = JSON.stringify(aExpected);
  } catch(e) {
    var aExpectedString = String(aExpected);
  }

  let diagnosis = "'" + aValueString + "' should equal '" +
                  aExpectedString + "'";
  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if an object does not equal another object
 *
 * @param {object} aValue
 *   The object to test.
 * @param {object} aExpected
 *   The object to strictly compare with.
 * @param {string} aMessage
 *   Message to show for the test result
 * @returns {boolean} Result of the test.
 */
Expect.prototype.notDeepEqual = function notEqual(aValue, aExpected, aMessage) {
  let condition = !this._deepEqual(aValue, aExpected);
  try {
    var aValueString = JSON.stringify(aValue);
  } catch(e) {
    var aValueString = String(aValue);
  }
  try {
    var aExpectedString = JSON.stringify(aExpected);
  } catch(e) {
    var aExpectedString = String(aExpected);
  }

  let diagnosis = "'" + aValueString + "' should not equal '" +
                  aExpectedString + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if the regular expression matches the string.
 *
 * @param {String} aString String to test.
 * @param {RegEx} aRegex Regular expression to use for testing that a match exists.
 * @param {String} aMessage Message to show for the test result
 * @returns {Boolean} Result of the test.
 */
Expect.prototype.match = function Expect_match(aString, aRegex, aMessage) {
  // XXX Bug 634948
  // Regex objects are transformed to strings when evaluated in a sandbox
  // For now lets re-create the regex from its string representation
  let pattern = flags = "";
  try {
    let matches = aRegex.toString().match(/\/(.*)\/(.*)/);

    pattern = matches[1];
    flags = matches[2];
  }
  catch (ex) {
  }

  let regex = new RegExp(pattern, flags);
  let condition = (aString.match(regex) !== null);
  let diagnosis = "'" + regex + "' matches for '" + aString + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if the regular expression does not match the string.
 *
 * @param {String} aString String to test.
 * @param {RegEx} aRegex Regular expression to use for testing that a match does not exist.
 * @param {String} aMessage Message to show for the test result
 * @returns {Boolean} Result of the test.
 */
Expect.prototype.notMatch = function Expect_notMatch(aString, aRegex, aMessage) {
  // XXX Bug 634948
  // Regex objects are transformed to strings when evaluated in a sandbox
  // For now lets re-create the regex from its string representation
  let pattern = flags = "";
  try {
    let matches = aRegex.toString().match(/\/(.*)\/(.*)/);

    pattern = matches[1];
    flags = matches[2];
  }
  catch (ex) {
  }

  let regex = new RegExp(pattern, flags);
  let condition = (aString.match(regex) === null);
  let diagnosis = "'" + regex + "' doesn't match for '" + aString + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if the string contains the pattern.
 *
 * @param {String} aString String to test.
 * @param {String} aPattern Pattern to look for in the string
 * @param {String} aMessage Message to show for the test result
 * @returns {Boolean} Result of the test.
 */
Expect.prototype.contain = function Expect_contain(aString, aPattern, aMessage) {
  let condition = (aString.indexOf(aPattern) !== -1);
  let diagnosis = "'" + aString + "' should contain '" + aPattern + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Test if the string does not contain the pattern.
 *
 * @param {String} aString String to test.
 * @param {String} aPattern Pattern to look for in the string
 * @param {String} aMessage Message to show for the test result
 * @returns {Boolean} Result of the test.
 */
Expect.prototype.notContain = function Expect_notContain(aString, aPattern, aMessage) {
  let condition = (aString.indexOf(aPattern) === -1);
  let diagnosis = "'" + aString + "' should not contain '" + aPattern + "'";

  return this._test(condition, aMessage, diagnosis);
};

/**
 * Waits for the callback evaluates to true
 *
 * @param {Function} aCallback Callback for evaluation
 * @param {String} aMessage Message to show for result
 * @param {Number} aTimeout Timeout in waiting for evaluation
 * @param {Number} aInterval Interval between evaluation attempts
 * @param {Object} aThisObject this object
 */
Expect.prototype.waitFor = function Expect_waitFor(aCallback, aMessage, aTimeout,
                                                   aInterval, aThisObject) {
  let condition = true;
  let message = aMessage;

  try {
    mozmill.utils.waitFor(aCallback, aMessage, aTimeout, aInterval, aThisObject);
  } catch (ex) {
    message = ex.message;
    condition = false;
  }

  return this._test(condition, message);
};

/**
 * The Assert class implements fatal assertions, and can be used in cases
 * when a failing test has to directly abort the current test function. All
 * remaining tasks will not be performed.
 *
 * @class Base class for fatal assertions
 * @extends assertions.Expect
 */
function Assert() {
}

Assert.prototype = new Expect();
Assert.prototype.constructor = Assert;
Assert.prototype.parent = Expect.prototype;


/**
 * Log a test as failing by throwing an AssertionException.
 *
 * @private
 * @param {Object} aResult Test result details used for reporting.
 * @param {String} aResult.fileName Name of the file in which the assertion failed.
 * @param {String} aResult.function Function in which the assertion failed.
 * @param {Number} aResult.lineNumber Line number of the file in which the assertion failed.
 * @param {String} aResult.message Message why the assertion failed.
 * @throws {Error}
 */
Assert.prototype._logFail = function Assert__logFail(aResult) {
  throw new Error(aResult.message, aResult.fileName, aResult.lineNumber);
};

/**
 * Waits for the callback evaluates to true
 *
 * @param {Function} aCallback Callback for evaluation
 * @param {String} aMessage Message to show for result
 * @param {Number} aTimeout Timeout in waiting for evaluation
 * @param {Number} aInterval Interval between evaluation attempts
 * @param {Object} aThisObject this object
 */
Assert.prototype.waitFor = function Assert_waitFor(aCallback, aMessage, aTimeout,
                                                   aInterval, aThisObject) {
  return mozmill.utils.waitFor(aCallback, aMessage, aTimeout, aInterval, aThisObject);
};


// Export of classes
assertions.Expect = Expect;
assertions.Assert = Assert;
assertions.expect = new Expect();
assertions.assert = new Assert();
