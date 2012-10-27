/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @fileoverview
 * The PrefsAPI adds support for preferences related functions. It gives access
 * to the preferences system and allows to handle the preferences dialog
 *
 * @version 1.0.1
 */

// Include required modules
var modalDialog = require("modal-dialog");
var utils = require("utils");

const PREF_PANE_ANIMATION = "browser.preferences.animateFadeIn";

// Preferences dialog element templates
const PREF_DIALOG_BUTTONS  = '/{"type":"prefwindow"}/anon({"anonid":"dlg-buttons"})';
const PREF_DIALOG_DECK     = '/{"type":"prefwindow"}/anon({"class":"paneDeckContainer"})/anon({"anonid":"paneDeck"})';
const PREF_DIALOG_SELECTOR = '/{"type":"prefwindow"}/anon({"orient":"vertical"})/anon({"anonid":"selector"})';


/**
 * Constructor
 *
 * @param {MozMillController} controller
 *        MozMill controller of the browser window to operate on.
 */
function preferencesDialog(controller) {
  this._controller = controller;
}

/**
 * Preferences dialog object to simplify the access to this dialog
 */
preferencesDialog.prototype = {
  /**
   * Returns the MozMill controller
   *
   * @returns Mozmill controller
   * @type {MozMillController}
   */
  get controller() {
    return this._controller;
  },

  /**
   * Retrieve the currently selected panel
   *
   * @returns The panel element
   * @type {ElemBase}
   */
  get selectedPane() {
    return this.getElement({type: "deck_pane"});
  },

  /**
   * Get the given pane id
   */
  get paneId() {
    // Check if the selector and the pane are consistent
    var selector = this.getElement({type: "selector"});

    this._controller.waitFor(function () {
      return selector.getNode().selectedItem.getAttribute('pane') === this.selectedPane.getNode().id;
    }, "Pane has been changed - expected '" + this.selectedPane.getNode().id + "'",
       undefined, undefined, this);

    return this.selectedPane.getNode().id;
  },

  /**
   * Set the given pane by id
   *
   * @param {string} id of the pane
   */
  set paneId(id) {
    // Disable the animation when switching panes
    preferences.setPref(PREF_PANE_ANIMATION, false);

    var button = this.getElement({type: "selector_button", value: id});
    this._controller.waitThenClick(button);

    try {
      var documentElement = this._controller.window.document.documentElement;

      this._controller.waitFor(function () {
        return documentElement.lastSelected === id;
      }, "Pane has been changed - expected '" + id + "'");
    }
    catch (e) {
      throw e;
    }
    finally {
      preferences.clearUserPref(PREF_PANE_ANIMATION);
    }

    return this.paneId;
  },

  /**
   * Close the preferences dialog
   *
   * @param {MozMillController} controller
   *        MozMillController of the window to operate on
   * @param {boolean} saveChanges
   *        (Optional) If true the OK button is clicked on Windows which saves
   *        the changes. On OS X and Linux changes are applied immediately
   */
  close : function preferencesDialog_close(saveChanges) {
    saveChanges = (saveChanges == undefined) ? false : saveChanges;

    if (mozmill.isWindows) {
      var button = this.getElement({type: "button", subtype: (saveChanges ? "accept" : "cancel")});
      this._controller.click(button);
    } else {
      this._controller.keypress(null, 'w', {accelKey: true});
    }
  },

  /**
   * Gets all the needed external DTD urls as an array
   *
   * @returns Array of external DTD urls
   * @type [string]
   */
  getDtds : function preferencesDialog_getDtds() {
    var dtds = ["chrome://browser/locale/preferences/aboutPermissions.dtd",
		 "chrome://browser/locale/preferences/advanced-scripts.dtd",
		 "chrome://browser/locale/preferences/advanced.dtd",
		 "chrome://browser/locale/preferences/applicationManager.dtd",
		 "chrome://browser/locale/preferences/applications.dtd",
		 "chrome://browser/locale/preferences/colors.dtd",
		 "chrome://browser/locale/preferences/connection.dtd",
		 "chrome://browser/locale/preferences/content.dtd",
		 "chrome://browser/locale/preferences/cookies.dtd",
		 "chrome://browser/locale/preferences/fonts.dtd",
		 "chrome://browser/locale/preferences/languages.dtd",
		 "chrome://browser/locale/preferences/main.dtd",
		 "chrome://browser/locale/preferences/permissions.dtd",
		 "chrome://browser/locale/preferences/preferences.dtd",
		 "chrome://browser/locale/preferences/privacy.dtd",
		 "chrome://browser/locale/preferences/security.dtd",
		 "chrome://browser/locale/preferences/selectBookmark.dtd",
		 "chrome://browser/locale/preferences/sync.dtd",
		 "chrome://browser/locale/preferences/tabs.dtd"];
    return dtds;
  },

  /**
   * Retrieve an UI element based on the given spec
   *
   * @param {object} spec
   *        Information of the UI element which should be retrieved
   *        type: General type information
   *        subtype: Specific element or property
   *        value: Value of the element or property
   * @returns Element which has been created
   * @type {ElemBase}
   */
  getElement : function aboutSessionRestore_getElement(spec) {
    var elem = null;

    switch(spec.type) {
      case "button":
        elem = new elementslib.Lookup(this._controller.window.document, PREF_DIALOG_BUTTONS +
                                      '/{"dlgtype":"' + spec.subtype + '"}');
        break;
      case "deck":
        elem = new elementslib.Lookup(this._controller.window.document, PREF_DIALOG_DECK);
        break;
      case "deck_pane":
        var deck = this.getElement({type: "deck"}).getNode();

        // XXX: Bug 390724 - selectedPane is broken. So iterate through all elements
        var panel = deck.boxObject.firstChild;
        for (var ii = 0; ii < deck.selectedIndex; ii++)
          panel = panel.nextSibling;

        elem = new elementslib.Elem(panel);
        break;
      case "selector":
        elem = new elementslib.Lookup(this._controller.window.document, PREF_DIALOG_SELECTOR);
        break;
      case "selector_button":
        elem = new elementslib.Lookup(this._controller.window.document, PREF_DIALOG_SELECTOR +
                                      '/{"pane":"' + spec.value + '"}');
        break;
      default:
        throw new Error(arguments.callee.name + ": Unknown element type - " + spec.type);
    }

    return elem;
  }
};

/**
 * Preferences object to simplify the access to the nsIPrefBranch.
 */
var preferences = {
  _prefService : Cc["@mozilla.org/preferences-service;1"].
                 getService(Ci.nsIPrefService),

  /**
   * Use branch to access low level functions of nsIPrefBranch
   *
   * @return Instance of the preferences branch
   * @type nsIPrefBranch
   */
  get prefBranch() {
    return this._prefService.QueryInterface(Ci.nsIPrefBranch);
  },

  /**
   * Use defaultPrefBranch to access low level functions of the default branch
   *
   * @return Instance of the preferences branch
   * @type nsIPrefBranch
   */
  get defaultPrefBranch() {
    return this._prefService.getDefaultBranch("");
  },

  /**
   * Use prefService to access low level functions of nsIPrefService
   *
   * @return Instance of the pref service
   * @type nsIPrefService
   */
  get prefService() {
    return this._prefService;
  },

  /**
   * Clear a user set preference
   *
   * @param {string} prefName
   *        The user-set preference to clear
   * @return False if the preference had the default value
   * @type boolean
   **/
  clearUserPref : function preferences_clearUserPref(prefName) {
    try {
      this.prefBranch.clearUserPref(prefName);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Retrieve the value of an individual preference.
   *
   * @param {string} prefName
   *        The preference to get the value of.
   * @param {boolean/number/string} defaultValue
   *        The default value if preference cannot be found.
   * @param {boolean/number/string} defaultBranch
   *        If true the value will be read from the default branch (optional)
   * @param {string} interfaceType
   *        Interface to use for the complex value (optional)
   *        (nsILocalFile, nsISupportsString, nsIPrefLocalizedString)
   *
   * @return The value of the requested preference
   * @type boolean/int/string/complex
   */
  getPref : function preferences_getPref(prefName, defaultValue, defaultBranch,
                                         interfaceType) {
    try {
      branch = defaultBranch ? this.defaultPrefBranch : this.prefBranch;

      // If interfaceType has been set, handle it differently
      if (interfaceType != undefined) {
        return branch.getComplexValue(prefName, interfaceType);
      }

      switch (typeof defaultValue) {
        case ('boolean'):
          return branch.getBoolPref(prefName);
        case ('string'):
          return branch.getCharPref(prefName);
        case ('number'):
          return branch.getIntPref(prefName);
        default:
          return undefined;
      }
    } catch(e) {
      return defaultValue;
    }
  },

  /**
   * Set the value of an individual preference.
   *
   * @param {string} prefName
   *        The preference to set the value of.
   * @param {boolean/number/string/complex} value
   *        The value to set the preference to.
   * @param {string} interfaceType
   *        Interface to use for the complex value
   *        (nsILocalFile, nsISupportsString, nsIPrefLocalizedString)
   *
   * @return Returns if the value was successfully set.
   * @type boolean
   */
  setPref : function preferences_setPref(prefName, value, interfaceType) {
    try {
      switch (typeof value) {
        case ('boolean'):
          this.prefBranch.setBoolPref(prefName, value);
          break;
        case ('string'):
          this.prefBranch.setCharPref(prefName, value);
          break;
        case ('number'):
          this.prefBranch.setIntPref(prefName, value);
          break;
        default:
          this.prefBranch.setComplexValue(prefName, interfaceType, value);
      }
    } catch(e) {
      return false;
    }

    return true;
  }
};

/**
 * Open the preferences dialog and call the given handler
 *
 * @param {MozMillController} controller
 *        MozMillController which is the opener of the preferences dialog
 * @param {function} callback
 *        The callback handler to use to interact with the preference dialog
 * @param {function} launcher
 *        (Optional) A callback handler to launch the preference dialog
 */
function openPreferencesDialog(controller, callback, launcher) {
  if (!controller)
    throw new Error("No controller given for Preferences Dialog");
  if (typeof callback != "function")
    throw new Error("No callback given for Preferences Dialog");

  if (mozmill.isWindows) {
    // Preference dialog is modal on windows, set up our callback
    var prefModal = new modalDialog.modalDialog(controller.window);
    prefModal.start(callback);
  }

  // Launch the preference dialog
  if (launcher) {
    launcher();
  } else {
    mozmill.getPreferencesController();
  }

  if (mozmill.isWindows) {
    prefModal.waitForDialog();
  } else {
    // Get the window type of the preferences window depending on the application
    var prefWindowType = null;
    switch (mozmill.Application) {
      case "Thunderbird":
        prefWindowType = "Mail:Preferences";
        break;
      default:
        prefWindowType = "Browser:Preferences";
    }

    utils.handleWindow("type", prefWindowType, callback);
  }
}

// Export of variables
exports.preferences = preferences;

// Export of functions
exports.openPreferencesDialog = openPreferencesDialog;

// Export of classes
exports.preferencesDialog = preferencesDialog;
