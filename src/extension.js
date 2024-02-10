/**
 * @author github.com/PraneshASP
 * @license MIT
 *
 * */

/** imports */
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

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
  generateDeploymentReportActiveFile, generateDeploymentReportContextMenu
} = require("./commands/deployment-report");

const { treeFilesCodeActionProvider, treeFilesDiagnosticCollection } = require("./commands/parse-tree");


const { scaffoldActiveFile, scaffoldContextMenu } = require("./commands/bulloak-scaffold");

const { findSolidityFiles } = require("./helpers");


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



  async function provideCompletionItems(document, position) {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    if (!linePrefix.startsWith('import')) {
      return undefined;
    }

    // Step 1: Read and parse remappings
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return undefined; // No workspace folder open

    const rootPath = workspaceFolders[0].uri.fsPath;
    const remappingsPath = path.join(rootPath, 'remappings.txt');
    let remappings = {};

    if (fs.existsSync(remappingsPath)) {
      const remappingsContent = fs.readFileSync(remappingsPath, 'utf8');
      remappingsContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        remappings[key.trim()] = val.trim();
      });
    }

    // Step 2: Apply remappings to import paths
    const solidityFiles = await findSolidityFiles();
    const currentFilePath = document.uri.fsPath;
    const currentDir = path.dirname(currentFilePath);


    const completionItems = solidityFiles.map(file => {
      let filePath = vscode.workspace.asRelativePath(file, false);
      let remappedPath = filePath; // Start with the original path

      // Apply remappings
      Object.entries(remappings).forEach(([key, value]) => {
        if (filePath.startsWith(value)) {
          // Replace the matching part of the path with the remapping key
          remappedPath = filePath.replace(value, key);
        }
      });

      // Determine if the path was remapped
      const isRemapped = remappedPath !== filePath;

      // Use the remapped path if available, otherwise use the relative path
      const finalPath = isRemapped ? remappedPath : `./${path.relative(currentDir, file).split(path.sep).join('/')}`;

      const contractName = path.basename(file, '.sol');
      const completionItem = new vscode.CompletionItem(`${contractName} from "${finalPath}"`, vscode.CompletionItemKind.File);

      // Format the insert text based on whether the path was remapped
      completionItem.insertText = `{${contractName}} from "${finalPath}";`;

      return completionItem;
    });


    return completionItems;
  }

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider('solidity', { provideCompletionItems }, ['"', "{"]));


  vscode.window.visibleTextEditors.map(editor => {
    if (editor && editor.document && editor.document.languageId == "solidity") {
      unusedImportsActiveFile(editor);
    }
  });

}


/* exports */
exports.activate = onActivate;
