/**
 * @author github.com/PraneshASP
 * @license MIT
 *
 * */

/** imports */
const vscode = require("vscode");
const cp = require("child_process");
const path = require("path");
const fs = require("fs");

/** global vars */
const LANGID = "solidity";
const EXTENSION_PREFIX = "vscode-solidity-inspector";

function newWindowBeside(content) {
  vscode.workspace
    .openTextDocument({ content: content, language: LANGID })
    .then((doc) =>
      vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    );
}

function getContractRootDir(currentDir) {
  while (
    !fs.existsSync(path.join(currentDir, "foundry.toml")) &&
    !fs.existsSync(path.join(currentDir, "hardhat.config.js")) &&
    !fs.existsSync(path.join(currentDir, "hardhat.config.ts"))
  ) {
    currentDir = path.join(currentDir, "..");
  }

  console.log("**Current dir", currentDir);
  return currentDir;
}

/** event funcs */
function onActivate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      EXTENSION_PREFIX + ".activeFile.irOptimizer",
      async (args) => {
        let activeDoc = vscode.window.activeTextEditor.document;
        let activeFile = activeDoc.fileName;

        if (activeFile.endsWith(".sol")) {
          const contractPathArray = activeFile.split("/"); //activeFile.substring(0, activeFile.length - 4);
          let contractName = contractPathArray[contractPathArray.length - 1];
          contractName = contractName.substring(0, contractName.length - 4);
          contractPathArray.pop();

          let contractDir = await getContractRootDir(
            contractPathArray.join("/")
          );

          cp.exec(
            `cd ${contractDir} && forge inspect ${contractName} ir-optimized`,
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
        } else {
          vscode.window.showErrorMessage(
            `[Optimization failed] ${activeFile}\n\nOnly .sol files in a Foundry project are supported for now.`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      EXTENSION_PREFIX + ".contextMenu.irOptimizer",
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
            `cd ${contractDir} && forge inspect ${contractName} ir-optimized`,
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      EXTENSION_PREFIX + ".activeFile.asmOptimizer",
      async (args) => {
        let activeDoc = vscode.window.activeTextEditor.document;
        let activeFile = activeDoc.fileName;

        if (activeFile.endsWith(".sol")) {
          const contractPathArray = activeFile.split("/"); //activeFile.substring(0, activeFile.length - 4);
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
        } else {
          vscode.window.showErrorMessage(
            `[Optimization failed] ${activeFile}\n\nOnly .sol files in a Foundry project are supported for now.`
          );
        }
      }
    )
  );
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
