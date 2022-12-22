/**
 * @author github.com/PraneshASP
 * @license MIT
 *
 * */

/** imports */
const vscode = require("vscode");
const cp = require("child_process");
const { newWindowBeside, getContractRootDir } = require("./helpers");

const {
  irOptimizerActiveFile,
  irOptimizerContextMenu,
} = require("./commands/ir-optimizer");

const { asmOptimizerActiveFile } = require("./commands/asm-optimizer");

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

/** event funcs */
function onActivate(context) {
  context.subscriptions.push(irOptimizerActiveFileSubscription);
  context.subscriptions.push(irOptimizerContextMenuSubscription);

  context.subscriptions.push(asmOptimizerActiveFileSubscription);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      EXTENSION_PREFIX + ".contextMenu.asmOptimizer",
      async (clickedFile, selectedFiles) => {
        for (let index = 0; index < selectedFiles.length; index++) {
          const activeFile = selectedFiles[index].path;
          if (!activeFile.endsWith(".sol")) continue;

          const contractPathArray = activeFile.split("/");
          let contractName = contractPathArray[contractPathArray.length - 1];
          contractName = contractName.substring(0, contractName.length - 4);

          contractPathArray.pop();

          let contractDir = await getContractRootDir(
            contractPathArray.join("/")
          );

          cp.exec(
            `cd ${contractDir} && forge inspect ${contractName} asm-optimized`,
            (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(
                  `[Optimization failed] ${contractName}\n${err.message}\n\nNOTE: Please make sure to install 'forge' before using this extension`
                );
                console.error(err);
              }
              newWindowBeside(stdout);
            }
          );
        }
      }
    )
  );
}

/* exports */
exports.activate = onActivate;
