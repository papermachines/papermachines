/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Include required modules
var { assert } = require("assertions");

const TIMEOUT_MODAL_DIALOG = 5000;
const DELAY_CHECK = 100;

/**
 * Observer object to find the modal dialog spawned by a controller
 *
 * @constructor
 * @class Observer used to find a modal dialog
 *
 * @param {object} aOpener
 *        Window which is the opener of the modal dialog
 * @param {function} aCallback
 *        The callback handler to use to interact with the modal dialog
 */
function mdObserver(aOpener, aCallback) {
  this._opener = aOpener;
  this._callback = aCallback;
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
}

mdObserver.prototype = {

  /**
   * Set our default values for our internal properties
   */
  _opener : null,
  _callback: null,
  _timer: null,
  exception: null,
  finished: false,

  /**
   * Check if the modal dialog has been opened
   *
   * @returns {object} The modal dialog window found, or null.
   */
  findWindow : function mdObserver_findWindow() {
    var window = mozmill.wm.getMostRecentWindow('');

    // Get the WebBrowserChrome and check if it's a modal window
    var chrome = window.QueryInterface(Ci.nsIInterfaceRequestor).
                 getInterface(Ci.nsIWebNavigation).
                 QueryInterface(Ci.nsIDocShellTreeItem).
                 treeOwner.
                 QueryInterface(Ci.nsIInterfaceRequestor).
                 getInterface(Ci.nsIWebBrowserChrome);
    if (!chrome.isWindowModal()) {
      return null;
    }

    // Opening a modal dialog from a modal dialog would fail, if we wouldn't
    // check for the opener of the modal dialog
    var found = false;
    if (window.opener) {
      found = (mozmill.utils.getChromeWindow(window.opener) == this._opener);
    }
    else {
      // Also note that it could happen that dialogs don't have an opener
      // (i.e. clear recent history). In such a case make sure that the most
      // recent window is not the passed in reference opener
      found = (window != this._opener);
    }

    return (found ? window : null);
  },

  /**
   * Called by the timer in the given interval to check if the modal dialog has
   * been opened. Once it has been found the callback gets executed
   *
   * @param {object} aSubject Not used.
   * @param {string} aTopic Not used.
   * @param {string} aData Not used.
   */
  observe : function mdObserver_observe(aSubject, aTopic, aData) {
    var controller = null;
    var isLoaded = false;
    var window = null;

    // Check if the window has been found and successfully loaded
    try {
      window = this.findWindow();

      // XXX: Bug 668202
      //      MozMillController blocks thread execution if window is null
      if (window) {
        controller = new mozmill.controller.MozMillController(window);

        // XXX: bug 661408
        // Remove extra checks once Mozmill 1.5.4 has been released
        if ("isLoaded" in controller)
          isLoaded = controller.isLoaded()
        else if ("documentLoaded" in controller.window)
          isLoaded = controller.window.documentLoaded;
      }
    }
    catch (ex) {
      this.exception = ex;
    }

    // Only execute the callback when the window has been loaded
    if (isLoaded) {
      try {
        this._callback(controller);
      }
      catch (ex) {
        // Store the exception, so it can be forwarded if a modal dialog has
        // been opened by another modal dialog
        this.exception = ex;
      }

      this.finished = true;
      this.stop();

      if (window) {
        window.close();
      }
    }
    else {
      // otherwise try again in a bit
      if (this._timer)
        this._timer.init(this, DELAY_CHECK, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  /**
   * Stop the timer which checks for new modal dialogs
   */
  stop : function mdObserver_stop() {
    delete this._timer;
  }
};


/**
 * Creates a new instance of modalDialog.
 *
 * @constructor
 * @class Handler for modal dialogs
 *
 * @param {object} aWindow [optional - default: null]
 *        Window which is the opener of the modal dialog
 */
function modalDialog(aWindow) {
  this._window = aWindow || null;
}

modalDialog.prototype = {

  /**
   * Simply checks if the modal dialog has been processed
   *
   * @returns {boolean} True, if the dialog has been processed
   */
  get finished() {
    return (!this._observer || this._observer.finished);
  },

  /**
   * Start timer to wait for the modal dialog.
   *
   * @param {function} aCallback
   *        The callback handler to use to interact with the modal dialog
   */
  start : function modalDialog_start(aCallback) {
    assert.ok(aCallback, arguments.callee.name + ": Callback has been specified.");

    this._observer = new mdObserver(this._window, aCallback);

    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.init(this._observer, DELAY_CHECK, Ci.nsITimer.TYPE_ONE_SHOT);
  },

  /**
   * Stop the timer which checks for new modal dialogs
   */
  stop : function modalDialog_stop() {
    delete this._timer;

    if (this._observer) {
      this._observer.stop();
      this._observer = null;
    }
  },

  /**
   * Wait until the modal dialog has been processed.
   *
   * @param {Number} aTimeout (optional - default 5s)
   *        Duration to wait
   */
  waitForDialog : function modalDialog_waitForDialog(aTimeout) {
    var timeout = aTimeout || TIMEOUT_MODAL_DIALOG;

    if (!this._observer) {
      return;
    }

    try {
      assert.waitFor(function () {
        return this.finished;
      }, "Modal dialog has been found and processed", timeout, undefined, this);

      // Forward the raised exception so we can detect failures in modal dialogs
      assert.ok(!this._observer.exception, this._observer.exception);
    }
    finally {
      this.stop();
    }
  }
}


// Export of classes
exports.modalDialog = modalDialog;
