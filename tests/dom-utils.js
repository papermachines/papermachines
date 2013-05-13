/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Include required modules
var { assert, expect } = require("assertions");
var modalDialog = require("modal-dialog");
var utils = require("utils");


/**
 * DOMWalker Constructor
 *
 * @param {MozMillController} controller
 *        MozMill controller of the window to operate on.
 * @param {Function} callbackFilter
 *        callback-method to filter nodes
 * @param {Function} callbackNodeTest
 *        callback-method to test accepted nodes
 * @param {Function} callbackResults
 *        callback-method to process the results
 *        [optional - default: undefined]
 */
function DOMWalker(controller, callbackFilter, callbackNodeTest,
                   callbackResults) {

  this._controller = controller;
  this._callbackFilter = callbackFilter;
  this._callbackNodeTest = callbackNodeTest;
  this._callbackResults = callbackResults;
}

DOMWalker.FILTER_ACCEPT = 1;
DOMWalker.FILTER_REJECT = 2;
DOMWalker.FILTER_SKIP = 3;

DOMWalker.GET_BY_ID = "id";
DOMWalker.GET_BY_SELECTOR = "selector";

DOMWalker.WINDOW_CURRENT = 1;
DOMWalker.WINDOW_MODAL = 2;
DOMWalker.WINDOW_NEW = 4;

DOMWalker.prototype = {
  /**
   * Returns the filter-callback
   *
   * @returns Function
   */
  get callbackFilter() {
    return this._callbackFilter;
  },

  /**
   * Returns the node-testing-callback
   *
   * @returns Function
   */
  get callbackNodeTest() {
    return this._callbackNodeTest;
  },

  /**
   * Returns the results-callback
   *
   * @returns Function
   */
  get callbackResults() {
    return this._callbackResults;
  },

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
   * The main DOMWalker function.
   *
   * It start's the _walk-method for a given window or other dialog, runs
   * a callback to process the results for that window/dialog.
   * After that switches to provided new windows/dialogs.
   *
   * @param {array of objects} ids
   *        Contains informations on the elements to open while
   *        Object-elements:  getBy         - attribute-name of the attribute
   *                                          containing the identification
   *                                          information for the opener-element
   *                          subContent    - array of ids of the opener-elements
   *                                          in the window with the value of
   *                                          the above getBy-attribute
   *                          target        - information, where the new
   *                                          elements will be opened
   *                                          [1|2|4]
   *                          title         - title of the opened dialog/window
   *                          waitFunction  - The function used as an argument
   *                                          for waitFor to wait
   *                                          before starting the walk.
   *                                          [optional - default: no waiting]
   *                          windowHandler - Window instance
   *                                          [only needed for some tests]
   *
   * @param {Node} root
   *        Node to start testing from
   *        [optional - default: this._controller.window.document.documentElement]
   * @param {Function} waitFunction
   *        The function used as an argument for waitFor to
   *        wait before starting the walk.
   *        [optional - default: no waiting]
   */
  walk : function DOMWalker_walk(ids, root, waitFunction) {
    if (typeof waitFunction == 'function')
      expect.waitFor(waitFunction());

    if (!root)
      root = this._controller.window.document.documentElement;

    var resultsArray = this._walk(root);

    if (typeof this._callbackResults == 'function')
      this._callbackResults(this._controller, resultsArray);

    if (ids)
      this._prepareTargetWindows(ids);
  },

  /**
   * DOMWalker_filter filters a given node by submitting it to the
   * this._callbackFilter method to decide, if it should be submitted to
   * a provided this._callbackNodeTest method for testing (that hapens in case
   * of FILTER_ACCEPT).
   * In case of FILTER_ACCEPT and FILTER_SKIP, the children of such a node
   * will be filtered recursively.
   * Nodes with the nodeStatus "FILTER_REJECT" and their descendants will be
   * completetly ignored.
   *
   * @param {Node} node
   *        Node to filter
   * @param {array of elements} collectedResults
   *        An array with gathered all results from testing a given element
   * @returns An array with gathered all results from testing a given element
   * @type {array of elements}
   */
  _filter : function DOMWalker_filter(node, collectedResults) {
    var nodeStatus = this._callbackFilter(node);

    var nodeTestResults = [];

    switch (nodeStatus) {
      case DOMWalker.FILTER_ACCEPT:
        nodeTestResults = this._callbackNodeTest(node);
        collectedResults = collectedResults.concat(nodeTestResults);
        // no break here as we have to perform the _walk below too
      case DOMWalker.FILTER_SKIP:
        nodeTestResults = this._walk(node);
        break;
      default:
        break;
    }

    collectedResults = collectedResults.concat(nodeTestResults);

    return collectedResults;
  },

  /**
   * Retrieves and returns a wanted node based on the provided identification
   * set.
   *
   * @param {array of objects} idSet
   *        Contains informations on the elements to open while
   *        Object-elements:  getBy         - attribute-name of the attribute
   *                                          containing the identification
   *                                          information for the opener-element
   *                          subContent    - array of ids of the opener-elements
   *                                          in the window with the value of
   *                                          the above getBy-attribute
   *                          target        - information, where the new
   *                                          elements will be opened
   *                                          [1|2|4]
   *                          title         - title of the opened dialog/window
   *                          waitFunction  - The function used as an argument
   *                                          for waitFor to wait
   *                                          before starting the walk.
   *                                          [optional - default: no waiting]
   *                          windowHandler - Window instance
   *                                          [only needed for some tests]
   *
   * @returns Node
   * @type {Node}
   */
  _getNode : function DOMWalker_getNode(idSet) {
    var doc = this._controller.window.document;

    // QuerySelector seems to be unusuale for id's in this case:
    // https://developer.mozilla.org/En/Code_snippets/QuerySelector
    switch (idSet.getBy) {
      case DOMWalker.GET_BY_ID:
        return doc.getElementById(idSet[idSet.getBy]);
      case DOMWalker.GET_BY_SELECTOR:
        return doc.querySelector(idSet[idSet.getBy]);
      default:
        throw new Error("Not supported getBy-attribute: " + idSet.getBy);
    }
  },

  /**
   * Main entry point to open new elements like windows, tabpanels, prefpanes,
   * dialogs
   *
   * @param {array of objects} ids
   *        Contains informations on the elements to open while
   *        Object-elements:  getBy         - attribute-name of the attribute
   *                                          containing the identification
   *                                          information for the opener-element
   *                          subContent    - array of ids of the opener-elements
   *                                          in the window with the value of
   *                                          the above getBy-attribute
   *                          target        - information, where the new
   *                                          elements will be opened
   *                                          [1|2|4]
   *                          title         - title of the opened dialog/window
   *                          waitFunction  - The function used as an argument
   *                                          for waitFor to wait
   *                                          before starting the walk.
   *                                          [optional - default: no waiting]
   *                          windowHandler - Window instance
   *                                          [only needed for some tests]
   */
  _prepareTargetWindows : function DOMWalker_prepareTargetWindows(ids) {
    var doc = this._controller.window.document;

    // Go through all the provided ids
    for (var i = 0; i < ids.length; i++) {
      var node = this._getNode(ids[i]);

      // Go further only, if the needed element exists
      if (node) {
        var idSet = ids[i];

        // Pre Hook
        if ('preHook' in idSet) {
          assert.equal(typeof idSet.preHook, "function",
                       "preHook is not a function");
          idSet.preHook.call(node);
        }

        try {
          // Decide if what we want to open is a new normal/modal window or if it
          // will be opened in the current window.
          switch (idSet.target) {
            case DOMWalker.WINDOW_CURRENT:
              this._processNode(node, idSet);
              break;
            case DOMWalker.WINDOW_MODAL:
              // Modal windows have to be able to access that informations
              var modalInfos = {ids : idSet.subContent,
                                callbackFilter :  this._callbackFilter,
                                callbackNodeTest : this._callbackNodeTest,
                                callbackResults : this._callbackResults,
                                waitFunction : idSet.waitFunction}
              persisted.modalInfos = modalInfos;

              var md = new modalDialog.modalDialog(this._controller.window);
              md.start(this._modalWindowHelper);

              this._processNode(node, idSet);
              md.waitForDialog();
              break;
            case DOMWalker.WINDOW_NEW:
              this._processNode(node, idSet);

              // Get the new non-modal window controller
              var controller = null;

              if ('type' in idSet) {
                controller = utils.handleWindow('type', idSet.type, undefined, false);
              } else {
                controller = utils.handleWindow('title', idSet.title, undefined, false);
              }

              // Start a new DOMWalker instance
              let domWalker = new DOMWalker(controller, this._callbackFilter,
                                            this._callbackNodeTest,
                                            this._callbackResults);
              domWalker.walk(idSet.subContent,
                             controller.window.document.documentElement,
                             idSet.waitFunction);

              // Close the window
              controller.window.close();
              break;
            default:
              throw new Error("Node does not exist: " + ids[i][ids[i].getBy]);
          }
        } finally {
          // Post Hook
          // We want to make sure this code is always run to revert any changes
          // done in the Pre Hook
          if ('postHook' in idSet) {
            assert.equal(typeof idSet.postHook, "function",
                         "postHook is not a function");
            idSet.postHook.call(node);
          }
        }
      }
    }
  },

  /**
   * Opens new windows/dialog and starts the DOMWalker.walk() in case of dialogs
   * in existing windows.
   *
   * @param {Node} activeNode
   *        Node that holds the information which way
   *        to open the new window/dialog
   * @param {object} idSet
   *        ID set for the element to open
   */
  _processNode: function DOMWalker_processNode(activeNode, idSet) {
    var doc = this._controller.window.document;
    var nodeToProcess = this._getNode(idSet);

    // Opens a new window/dialog through a menulist and runs DOMWalker.walk()
    // for it.
    // If the wanted window/dialog is already selected, just run this function
    // recursively for it's descendants.
    if (activeNode.localName == "menulist") {
      if (nodeToProcess.value != idSet.value) {
        var dropDown = new elementslib.Elem(nodeToProcess);
        this._controller.waitForElement(dropDown);

        this._controller.select(dropDown, null, null, idSet.value);

        assert.waitFor(function() {
          return nodeToProcess.value == idSet.value;
        }, "The menu item did not load in time: " + idSet.value);

        // If the target is a new modal/non-modal window, this.walk() has to be
        // started by the method opening that window. If not, we do it here.
        if (idSet.target == DOMWalker.WINDOW_CURRENT)
          this.walk(idSet.subContent, null, idSet.waitFunction);
      } else if (nodeToProcess.selected && idSet.subContent &&
                 idSet.subContent.length > 0) {
        this._prepareTargetWindows(idSet.subContent);
      }
    }

    // Opens a new prefpane using a provided windowHandler object
    // and runs DOMWalker.walk() for it.
    // If the wanted prefpane is already selected, just run this function
    // recursively for it's descendants.
    else if (activeNode.localName == "prefpane") {
      var windowHandler = idSet.windowHandler;

      if (windowHandler.paneId != idSet.id) {
        windowHandler.paneId = idSet.id;

        // Wait for the pane's content to load and to be fully displayed
        assert.waitFor(function() {
          return nodeToProcess.loaded;
        }, "The pane did not load in time: " + idSet.id);

        // If the target is a new modal/non-modal window, this.walk() has to be
        // started by the method opening that window. If not, we do it here.
        if (idSet.target == DOMWalker.WINDOW_CURRENT)
          this.walk(idSet.subContent, null, idSet.waitFunction);
      } else if (windowHandler.paneId == idSet.id && idSet.subContent &&
                 idSet.subContent.length > 0) {
        this._prepareTargetWindows(idSet.subContent);
      }
    }

    // Switches to another tab and runs DOMWalker.walk() for it.
    // If the wanted tabpanel is already selected, just run this function
    // recursively for it's descendants.
    else if (activeNode.localName == "tab") {
      if (nodeToProcess.selected != true) {
        this._controller.click(new elementslib.Elem(nodeToProcess));

        // If the target is a new modal/non-modal window, this.walk() has to be
        // started by the method opening that window. If not, we do it here.
        if (idSet.target == DOMWalker.WINDOW_CURRENT)
          this.walk(idSet.subContent, null, idSet.waitFunction);
      } else if (nodeToProcess.selected && idSet.subContent
                 && idSet.subContent.length > 0) {
        this._prepareTargetWindows(idSet.subContent);
      }
    }

    // Opens a new dialog/window by clicking on an object and runs
    // DOMWalker.walk() for it.
    else {
      this._controller.click(new elementslib.Elem(nodeToProcess));

      // If the target is a new modal/non-modal window, this.walk() has to be
      // started by the method opening that window. If not, we do it here.
      if (idSet.target == DOMWalker.WINDOW_CURRENT)
        this.walk(idSet.subContent, null, idSet.waitFunction);
    }
  },

  /**
   * DOMWalker_walk goes recursively through the DOM, starting with a provided
   * root-node and filters the nodes using the this._filter method.
   *
   * @param {Node} root
   *        Node to start testing from
   *        [optional - default: this._controller.window.document.documentElement]
   * @returns An array with gathered all results from testing a given element
   * @type {array of elements}
   */
  _walk : function DOMWalker__walk(root) {
    assert.ok(root.childNodes, "root.childNodes exist");

    var collectedResults = [];

    // There seems to be no other way to get to the nodes hidden in the
    // "_buttons" object (see Bug 614949)
    if (root._buttons) {
      for each (button in root._buttons) {
        collectedResults = this._filter(button, collectedResults);
      }
    }

    for (var i = 0; i < root.childNodes.length; i++) {
      collectedResults = this._filter(root.childNodes[i], collectedResults);
    }

    return collectedResults;
  },

  /**
   * Callback function to handle new windows
   *
   * @param {MozMillController} controller
   *        MozMill controller of the new window to operate on.
   */
  _modalWindowHelper: function DOMWalker_modalWindowHelper(controller) {
    let domWalker = new DOMWalker(controller,
                                  persisted.modalInfos.callbackFilter,
                                  persisted.modalInfos.callbackNodeTest,
                                  persisted.modalInfos.callbackResults);
    domWalker.walk(persisted.modalInfos.ids,
                   controller.window.document.documentElement,
                   persisted.modalInfos.waitFunction);

    delete persisted.modalInfos;

    controller.window.close();
  }
}

/**
 * Default constructor
 *
 * @param {object} aRoot
 *        Root node in the DOM to use as parent
 */
function nodeCollector(aRoot) {
  this.root = aRoot;
}

/**
 * Node collector class
 */
nodeCollector.prototype = {
  /**
   * Converts current nodes to elements
   *
   * @returns List of elements
   * @type {array of ElemBase}
   */
  get elements() {
    var elements = [ ];

    Array.forEach(this._nodes, function(element) {
      elements.push(new elementslib.Elem(element));
    });

    return elements;
  },

  /**
   * Get the current list of DOM nodes
   *
   * @returns List of nodes
   * @type {array of object}
   */
  get nodes() {
    return this._nodes;
  },

  /**
   * Sets current nodes to entries from the node list
   *
   * @param {array of objects} aNodeList
   *        List of DOM nodes to set
   */
  set nodes(aNodeList) {
    if (aNodeList) {
      this._nodes = [ ];

      Array.forEach(aNodeList, function(node) {
        this._nodes.push(node);
      }, this);
    }
  },

  /**
   * Get the root node used as parent for a node collection
   *
   * @returns Current root node
   * @type {object}
   */
  get root() {
    return this._root;
  },

  /**
   * Sets root node
   *
   * @param {object} aRoot
   *        Element to use as root for node collection
   */
  set root(aRoot) {
    assert.ok(aRoot, "The root element has been specified.");

    this._root = mozmill.utils.unwrapNode(aRoot);
    this._nodes = [ ];

    // Because a window doesn't have the querySelector available we should
    // fallback to the document instead.
    if ("document" in this._root)
      this._root = this._root.document;

    this._document = ("ownerDocument" in this._root) ? this._root.ownerDocument
                                                     : this._root;
  },

  /**
   * Filter nodes given by the specified callback function
   *
   * @param {function} aCallback
   *        Function to test each element of the array.
   *        Elements: node, index (optional) , array (optional)
   * @param {object} aThisObject
   *        Object to use as 'this' when executing callback.
   *        [optional - default: function scope]
   *
   * @returns The class instance
   * @type {object}
   */
  filter : function nodeCollector_filter(aCallback, aThisObject) {
    assert.ok(aCallback, arguments.callee.name + ": Callback has been specified");

    this.nodes = Array.filter(this.nodes, aCallback, aThisObject);

    return this;
  },

  /**
   * Filter nodes by CSS property and its value
   *
   * @param {string} aProperty
   *        Property to filter for
   * @param {string} aValue
   *        Expected value of the CSS property
   *
   * @returns The class instance
   * @type {object}
   */
  filterByCSSProperty : function nodeCollector_filterByCSSProperty(aProperty, aValue) {
    return this.filter(function (node) {
      if (aProperty && aValue) {
        var style = node.ownerDocument.defaultView.getComputedStyle(node);
        return style.getPropertyValue(aProperty) === aValue;
      }
      else {
        return true;
      }
    });
  },

  /**
   * Filter nodes by DOM property and its value
   *
   * @param {string} aProperty
   *        Property to filter for
   * @param {string} aValue
   *        Expected value of the DOM property
   *        [optional - default: n/a]
   *
   * @returns The class instance
   * @type {object}
   */
  filterByDOMProperty : function nodeCollector_filterByDOMProperty(aProperty, aValue) {
    return this.filter(function (node) {
      if (aProperty && aValue)
        return node.getAttribute(aProperty) === aValue;
      else if (aProperty)
        return node.hasAttribute(aProperty);
      else
        return true;
    });
  },

  /**
   * Filter nodes by JS property and its value
   *
   * @param {string} aProperty
   *        Property to filter for
   * @param {string} aValue
   *        Expected value of the JS property
   *        [optional - default: n/a]
   *
   * @returns The class instance
   * @type {object}
   */
  filterByJSProperty : function nodeCollector_filterByJSProperty(aProperty, aValue) {
    return this.filter(function (node) {
      if (aProperty && aValue)
        return node[aProperty] === aValue;
      else if (aProperty)
        return aProperty in node;
      else
        return true;
    });
  },

  /**
   * Find anonymous node with the specified attribute and value
   *
   * @param {string} aAttribute
   *        DOM attribute of the wanted node
   * @param {string} aValue
   *        Value of the DOM attribute
   *
   * @returns The class instance
   * @type {object}
   */
  queryAnonymousNode : function nodeCollector_queryAnonymousNode(aAttribute, aValue) {
    var node = this._document.getAnonymousElementByAttribute(this._root,
                                                             aAttribute,
                                                             aValue);
    this.nodes = node ? [node] : [ ];

    return this;
  },

  /**
   * Find nodes with the specified selector
   *
   * @param {string} aSelector
   *        jQuery like element selector string
   *
   * @returns The class instance
   * @type {object}
   */
  queryNodes : function nodeCollector_queryNodes(aSelector) {
    this.nodes = this._root.querySelectorAll(aSelector);

    return this;
  }
}


// Exports of classes
exports.DOMWalker = DOMWalker;
exports.nodeCollector = nodeCollector;
