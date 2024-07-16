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

const {
  flattenActiveFile,
  flattenContextMenu,
} = require("./commands/flatten")

const {
  unusedImportsActiveFile,
} = require("./commands/highlight-unused-imports")

const {
  generateDeploymentReportActiveFile, generateDeploymentReportContextMenu, statusBarItem
} = require("./commands/deployment-report");

const { treeFilesCodeActionProvider, treeFilesDiagnosticCollection } = require("./commands/parse-tree");


const { scaffoldActiveFile, scaffoldContextMenu } = require("./commands/bulloak-scaffold");

const { provideCompletionItems, resetRemappings } = require("./completionItems.js");

const { activate: activateSeparator } = require("./commands/separator.js");

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

const flattenActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.flatten",
  flattenActiveFile
);

const flattenContextMenuSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".contextMenu.flatten",
  flattenContextMenu
);

const highlightUnusedImportsActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.highlightUnusedImports",
  unusedImportsActiveFile
);

const generateDeploymentReportActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.generateDeploymentReport",
  generateDeploymentReportActiveFile
);

const generateDeploymentReportContextMenuSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".contextMenu.generateDeploymentReport",
  generateDeploymentReportContextMenu
);

const scaffoldActiveFileSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".activeFile.scaffold",
  scaffoldActiveFile
);

const scaffoldContextMenuSubscription = vscode.commands.registerCommand(
  EXTENSION_PREFIX + ".contextMenu.scaffold",
  scaffoldContextMenu
);

/** event funcs */
function onActivate(context) {
  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (editor) {
      unusedImportsActiveFile(editor);
    }
  });

  vscode.workspace.onDidSaveTextDocument(() => {
    vscode.window.visibleTextEditors.map(editor => {
      if (editor && editor.document && editor.document.languageId == "solidity") {
        unusedImportsActiveFile(editor);
      }
    });
  });
  context.subscriptions.push(irOptimizerActiveFileSubscription);
  context.subscriptions.push(irOptimizerContextMenuSubscription);

  context.subscriptions.push(asmOptimizerActiveFileSubscription);
  context.subscriptions.push(asmOptimizerContextMenuSubscription);

  context.subscriptions.push(storageLayoutActiveFileSubscription);
  context.subscriptions.push(storageLayoutContextMenuSubscription);

  context.subscriptions.push(flattenActiveFileSubscription);
  context.subscriptions.push(flattenContextMenuSubscription);

  context.subscriptions.push(highlightUnusedImportsActiveFileSubscription);

  context.subscriptions.push(generateDeploymentReportActiveFileSubscription);
  context.subscriptions.push(generateDeploymentReportContextMenuSubscription);

  // Register the Code Action provider and diagnostic collection to the subscriptions
  context.subscriptions.push(treeFilesCodeActionProvider);
  context.subscriptions.push(treeFilesDiagnosticCollection);

  context.subscriptions.push(scaffoldActiveFileSubscription);
  context.subscriptions.push(scaffoldContextMenuSubscription);

  // Import suggestions. 
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider('solidity', { provideCompletionItems }, ['"', "{"]));
  context.subscriptions.push(vscode.commands.registerCommand(EXTENSION_PREFIX + '.resetRemappings', () => {
    resetRemappings();
    vscode.window.showInformationMessage('Remappings have been refreshed!');
  }));
 
  vscode.window.visibleTextEditors.map(editor => {
    if (editor && editor.document && editor.document.languageId == "solidity") {
      unusedImportsActiveFile(editor);
    }
  });

  // Activate separator
  activateSeparator(context);

  // Add status bar item to generate deployment summary
  context.subscriptions.push(statusBarItem());
}


/* exports */
exports.activate = onActivate;
