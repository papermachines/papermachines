/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @fileoverview
 * The WidgetsAPI adds support for handling objects like trees.
 */

var EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);

/**
 * Click the specified tree cell
 *
 * @param {MozMillController} controller
 *        MozMillController of the browser window to operate on
 * @param {tree} tree
 *        Tree to operate on
 * @param {number } rowIndex
 *        Index of the row
 * @param {number} columnIndex
 *        Index of the column
 * @param {object} eventDetails
 *        Details about the mouse event
 */
function clickTreeCell(controller, tree, rowIndex, columnIndex, eventDetails) {
  tree = tree.getNode();

  var selection = tree.view.selection;
  selection.select(rowIndex);
  tree.treeBoxObject.ensureRowIsVisible(rowIndex);

  // get cell coordinates
  var x = {}, y = {}, width = {}, height = {};
  var column = tree.columns[columnIndex];
  tree.treeBoxObject.getCoordsForCellItem(rowIndex, column, "text",
                                           x, y, width, height);

  controller.sleep(0);
  EventUtils.synthesizeMouse(tree.body, x.value + 4, y.value + 4,
                             eventDetails, tree.ownerDocument.defaultView);
  controller.sleep(0);
}

// Export of functions
exports.clickTreeCell = clickTreeCell;
