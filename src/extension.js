/**
 * @author github.com/PraneshASP
 * @license MIT
 *
 * */

/** imports */
const vscode = require("vscode");

const {
  irOptimizerActiveFile,
  irOptimizerContextMenu,
} = require("./commands/ir-optimizer");

const {
  asmOptimizerActiveFile,
  asmOptimizerContextMenu,
} = require("./commands/asm-optimizer");
const {
  storageLayoutActiveFile,
  storageLayoutContextMenu,
} = require("./commands/storage-inspector");

/** global vars */
const EXTENSION_PREFIX = "vscode-solidity-inspector";

/** register commands  */
const irOptimizerActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.irOptimizer",
  irOptimizerActiveFile
);

const irOptimizerContextMenuSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".contextMenu.irOptimizer",
  irOptimizerContextMenu
);

const asmOptimizerActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.asmOptimizer",
  asmOptimizerActiveFile
);

const asmOptimizerContextMenuSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".contextMenu.asmOptimizer",
  asmOptimizerContextMenu
);

const storageLayoutActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.storageLayout",
  storageLayoutActiveFile
);

const storageLayoutContextMenuSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".contextMenu.storageLayout",
  storageLayoutContextMenu
);

/** event funcs */
function onActivate(context) {
  context.subscriptions.push(irOptimizerActiveFileSubscription);
  context.subscriptions.push(irOptimizerContextMenuSubscription);

  context.subscriptions.push(asmOptimizerActiveFileSubscription);
  context.subscriptions.push(asmOptimizerContextMenuSubscription);

  context.subscriptions.push(storageLayoutActiveFileSubscription);
  context.subscriptions.push(storageLayoutContextMenuSubscription);
}
/* exports */
exports.activate = onActivate;
