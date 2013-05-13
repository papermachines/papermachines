/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @fileoverview
 * The UtilsAPI offers various helper functions for any other API which is
 * not already covered by another shared module.
 *
 * @version 1.0.3
 */

Cu.import("resource://gre/modules/Services.jsm");

// Include required modules
var { assert } = require("assertions");
var prefs = require("prefs");

/**
 * Get application specific informations
 * @see http://mxr.mozilla.org/mozilla-central/source/xpcom/system/nsIXULAppInfo.idl
 */
var appInfo = {
  /**
   * Get the application info service
   * @returns XUL runtime object
   * @type nsiXULRuntime
   */
  get appInfo() {
    return Services.appinfo;
  },

  /**
   * Get the build id
   * @returns Build id
   * @type string
   */
  get buildID() this.appInfo.appBuildID,

  /**
   * Get the application id
   * @returns Application id
   * @type string
   */
  get ID() this.appInfo.ID,

  /**
   * Get the application name
   * @returns Application name
   * @type string
   */
  get name() this.appInfo.name,

  /**
   * Get the operation system
   * @returns Operation system name
   * @type string
   */
  get os() this.appInfo.OS,

  /**
   * Get the product vendor
   * @returns Vendor name
   * @type string
   */
  get vendor() this.appInfo.vendor,

  /**
   * Get the application version
   * @returns Application version
   * @type string
   */
  get version() this.appInfo.version,

  /**
   * Get the build id of the Gecko platform
   * @returns Platform build id
   * @type string
   */
  get platformBuildID() this.appInfo.platformBuildID,

  /**
   * Get the version of the Gecko platform
   * @returns Platform version
   * @type string
   */
  get platformVersion() this.appInfo.platformVersion,

  /**
   * Get the currently used locale
   * @returns Current locale
   * @type string
   */
  get locale() {
    var registry = Cc["@mozilla.org/chrome/chrome-registry;1"]
                     .getService(Ci.nsIXULChromeRegistry);
    return registry.getSelectedLocale("global");
  },

  /**
   * Get the user agent string
   * @returns User agent
   * @type string
   */
  get userAgent() {
    var window = mozmill.wm.getMostRecentWindow("navigator:browser");
    if (window)
      return window.navigator.userAgent;
    return "";
  },

  /**
   * Get the ABI of the platform
   *
   * @returns {String} ABI version
   */
  get XPCOMABI() this.appInfo.XPCOMABI
};

/**
 * Assert if the current URL is identical to the target URL.
 * With this function also redirects can be tested.
 *
 * @param {MozmillController} controller
 *        MozMillController of the window to operate on
 * @param {string} targetURL
 *        URL to check
 */
function assertLoadedUrlEqual(controller, targetUrl) {
  var locationBar = new elementslib.ID(controller.window.document, "urlbar");
  var currentURL = locationBar.getNode().value;

  // Load the target URL
  controller.open(targetUrl);
  controller.waitForPageLoad();

  // Check the same web page has been opened
  assert.waitFor(function () {
    return locationBar.getNode().value === currentURL;
  }, "Current URL should be identical to the target URL - got " +
     locationBar.getNode().value + ", expected " + currentURL);
}

/**
 * Close the context menu inside the content area of the currently open tab
 *
 * @param {MozmillController} controller
 *        MozMillController of the window to operate on
 */
function closeContentAreaContextMenu(controller) {
  var contextMenu = new elementslib.ID(controller.window.document, "contentAreaContextMenu");
  controller.keypress(contextMenu, "VK_ESCAPE", {});
}

/**
 * Run tests against a given search form
 *
 * @param {MozMillController} controller
 *        MozMillController of the window to operate on
 * @param {ElemBase} searchField
 *        The HTML input form element to test
 * @param {string} searchTerm
 *        The search term for the test
 * @param {ElemBase} submitButton
 *        (Optional) The forms submit button
 * @param {number} timeout
 *        The timeout value for the single tests
 */
function checkSearchField(controller, searchField,
                                                     searchTerm, submitButton,
                                                     timeout) {
  controller.waitThenClick(searchField, timeout);
  controller.type(searchField, searchTerm);

  if (submitButton != undefined) {
    controller.waitThenClick(submitButton, timeout);
  }
}

/**
 * Create a new URI
 *
 * @param {string} spec
 *        The URI string in UTF-8 encoding.
 * @param {string} originCharset
 *        The charset of the document from which this URI string originated.
 * @param {string} baseURI
 *        If null, spec must specify an absolute URI. Otherwise, spec may be
 *        resolved relative to baseURI, depending on the protocol.
 * @return A URI object
 * @type nsIURI
 */
function createURI(spec, originCharset, baseURI) {
  return Services.io.newURI(spec, originCharset, baseURI);
}


/**
 * Empty the clipboard by assigning an empty string
 */
function emptyClipboard() {
  var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].
                  getService(Ci.nsIClipboardHelper);
  clipboard.copyString("");
}

/**
 * Format a URL by replacing all placeholders
 *
 * @param {String} aURL The URL which contains placeholders to replace
 *
 * @returns {String} The formatted URL
 */
function formatUrl(aURL) {
  return Services.urlFormatter.formatURL(aURL);
}

/**
 * Format a URL given by a preference and replace all placeholders
 *
 * @param {String} aPrefName The preference name which contains the URL
 *
 * @returns {String} The formatted URL
 */
function formatUrlPref(prefName) {
  return Services.urlFormatter.formatURLPref(prefName);
}

/**
 * Returns the default home page
 *
 * @return The URL of the default homepage
 * @type string
 */
function getDefaultHomepage() {
  var preferences = prefs.preferences;

  var prefValue = preferences.getPref("browser.startup.homepage", "",
                                      true, Ci.nsIPrefLocalizedString);
  return prefValue.data;
}

/**
 * Returns the value of an individual entity in a DTD file.
 *
 * @param [string] urls
 *        Array of DTD urls.
 * @param {string} entityId
 *        The ID of the entity to get the value of.
 *
 * @return The value of the requested entity
 * @type string
 */
function getEntity(urls, entityId) {
  // Add xhtml11.dtd to prevent missing entity errors with XHTML files
  urls.push("resource:///res/dtd/xhtml11.dtd");

  // Build a string of external entities
  var extEntities = "";
  for (i = 0; i < urls.length; i++) {
    extEntities += '<!ENTITY % dtd' + i + ' SYSTEM "' +
                   urls[i] + '">%dtd' + i + ';';
  }

  var parser = Cc["@mozilla.org/xmlextras/domparser;1"]
                  .createInstance(Ci.nsIDOMParser);
  var header = '<?xml version="1.0"?><!DOCTYPE elem [' + extEntities + ']>';
  var elem = '<elem id="elementID">&' + entityId + ';</elem>';
  var doc = parser.parseFromString(header + elem, 'text/xml');
  var elemNode = doc.querySelector('elem[id="elementID"]');

  assert.ok(elemNode, arguments.callee.name + ": Entity - " + entityId + " has been found");

  return elemNode.textContent;
}

/**
 * Returns the value of an individual property.
 *
 * @param {string} url
 *        URL of the string bundle.
 * @param {string} prefName
 *        The property to get the value of.
 *
 * @return The value of the requested property
 * @type string
 */
function getProperty(url, prefName) {
  var bundle = Services.strings.createBundle(url);

  try {
    return bundle.GetStringFromName(prefName);
  } catch (ex) {
    throw new Error(arguments.callee.name + ": Unknown property - " + prefName);
  }
}

/**
 * Get the profile folder and create a subfolder "downloads"
 * @return {string} path to the newly created folder
 */
function getProfileDownloadLocation() {
  var downloadDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
  downloadDir.append("downloads");

  return downloadDir.path;
}

/**
 * Function to handle non-modal windows
 *
 * @param {string} type
 *        Specifies how to check for the new window (possible values: type or title)
 * @param {string} text
 *        The window type of title string to search for
 * @param {function} callback (optional)
 *        Callback function to call for window specific tests
 * @param {boolean} close (optional - default: true)
 *        Make sure the window is closed after the return from the callback handler
 * @returns The MozMillController of the window (if the window hasn't been closed)
 */
function handleWindow(type, text, callback, close) {
  var window = null;

  // Set the window opener function to use depending on the type
  var func_ptr = null;
  switch (type) {
    case "type":
      func_ptr = mozmill.utils.getWindowByType;
      break;
    case "title":
      func_ptr = mozmill.utils.getWindowByTitle;
      break;
    default:
      throw new Error(arguments.callee.name + ": Unknown opener type - " + type);
  }

  try {
    // Wait until the window has been opened
    assert.waitFor(function () {
      window = func_ptr(text);
      return !!window;
    }, "Window has been found.");

    // Get the controller for the newly opened window
    var controller = new mozmill.controller.MozMillController(window);
    var windowId = mozmill.utils.getWindowId(window);

    // Call the specified callback method for the window
    if (callback) {
      callback(controller);
    }

    // Check if we have to close the window
    if (close === undefined)
      close = true;

    // Close the window if necessary and wait until it has been unloaded
    if (close && window) {

      try {
        window.close();
        assert.waitFor(function () {
          return !mozmill.controller.windowMap.contains(windowId);
        }, "Window has been closed.");
      } catch (e if e instanceof TypeError) {
        // The test itself has already destroyed the window. Also the object is
        // not available anymore because it has been marked as dead. We can fail
        // silently.
      }

      controller = null;
    }

    return controller;
  } catch (e) {
    try {
      if (window)
        window.close();
    } catch (ex if ex instanceof TypeError) {
      // The window object is not available anymore because it has been marked
      // as dead. We can fail silently.
    }

    throw e;
  }
}

/**
 * Checks the visibility of an element.
 *
 * Bug 490548: A test should fail if an element we operate on is not visible
 *
 * @param {MozmillController} controller
 *        MozMillController of the window to operate on
 * @param {ElemBase} elem
 *        Element to check its visibility
 */
function isDisplayed(controller, elem) {
  var element = elem.getNode();
  var visible;

  switch (element.nodeName) {
    case 'panel':
      visible = (element.state === 'open');
      break;
    default:
      var style = controller.window.getComputedStyle(element, '');
      var state = style.getPropertyValue('visibility');
      visible = (state === 'visible');
  }

  return visible;
}

/**
 * Helper function to remove a permission
 *
 * @param {string} aHost
 *        The host whose permission will be removed
 * @param {string} aType
 *        The type of permission to be removed
 */
function removePermission(aHost, aType) {
  Services.perms.remove(aHost, aType);
}

/**
 * Returns the value of a CSS Property for a specific Element
 *
 * @param {ElemBase} aElement
 *        Element to get its property
 * @param {String} aProperty
 *        Property name to be retrieved
 *
 * @return {String} Value of the CSS property
 */
function getElementStyle(aElement, aProperty) {
  var element = aElement.getNode();
  assert.ok(element, arguments.callee.name + " Element " + aElement.getInfo() + " has been found");

  var elementStyle = element.ownerDocument.defaultView.getComputedStyle(element);
  return elementStyle.getPropertyValue(aProperty);
}

/**
 * Helper function to ping the blocklist Service so Firefox updates the blocklist
 */
function updateBlocklist() {
  var blocklistService = Cc["@mozilla.org/extensions/blocklist;1"].
                         getService(Ci.nsIBlocklistService);
  blocklistService.QueryInterface(Ci.nsITimerCallback).notify(null);
}

// Export of variables
exports.appInfo = appInfo;

// Export of functions
exports.assertLoadedUrlEqual = assertLoadedUrlEqual;
exports.closeContentAreaContextMenu = closeContentAreaContextMenu;
exports.checkSearchField = checkSearchField;
exports.createURI = createURI;
exports.emptyClipboard = emptyClipboard;
exports.formatUrl = formatUrl;
exports.formatUrlPref = formatUrlPref;
exports.getDefaultHomepage = getDefaultHomepage;
exports.getElementStyle = getElementStyle;
exports.getEntity = getEntity;
exports.getProperty = getProperty;
exports.getProfileDownloadLocation = getProfileDownloadLocation;
exports.handleWindow = handleWindow;
exports.isDisplayed = isDisplayed;
exports.removePermission = removePermission;
exports.updateBlocklist = updateBlocklist;
