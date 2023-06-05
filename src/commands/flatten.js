const vscode = require("vscode");
const cp = require("child_process");
const { newWindowBeside } = require("../helpers");

async function flattenActiveFile(args) {
  let activeDoc = vscode.window.activeTextEditor.document;
  let activeFile = activeDoc.fileName;
  if (activeFile.endsWith(".sol")) {
    const contractPathArray = activeFile.split("/");
    let contractName = contractPathArray[contractPathArray.length - 1];
    contractName = contractName.substring(0, contractName.length - 4);
    contractPathArray.pop();

    let activeFileDirArray = activeFile.split('/');
    activeFileDirArray.pop();
    let activeFileDir = activeFileDirArray.join("/");
    cp.exec(
      `cd ${activeFileDir} && forge flatten ${contractName}.sol`,
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `[Operation failed] ${contractName}\n${err.message}\n\nNOTE: Please make sure to install 'forge' before using this extension`
          );
          console.error(err);
        }
        newWindowBeside(stdout);
      }
    );
  } else {
    vscode.window.showErrorMessage(
      `[Operation failed] ${activeFile}\n\nOnly .sol files in a Foundry project are supported for now.`
    );
  }
}

async function flattenContextMenu(clickedFile, selectedFiles) {
  for (let index = 0; index < selectedFiles.length; index++) {
    const activeFile = selectedFiles[index].path;
    if (!activeFile.endsWith(".sol")) continue;
    const contractPathArray = activeFile.split("/");
    let contractName = contractPathArray[contractPathArray.length - 1];
    contractName = contractName.substring(0, contractName.length - 4);

    contractPathArray.pop();

    let activeFileDirArray = activeFile.split('/');
    activeFileDirArray.pop();
    let activeFileDir = activeFileDirArray.join("/");
    cp.exec(
      `cd ${activeFileDir} && forge flatten ${contractName}.sol`,
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `[Operation failed] ${contractName}\n${err.message}\n\nNOTE: Please make sure to install 'forge' before using this extension`
          );
        }
        newWindowBeside(stdout);
      }
    );
  }
}

module.exports = { flattenActiveFile, flattenContextMenu };
