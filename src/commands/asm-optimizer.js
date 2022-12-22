const vscode = require("vscode");
const cp = require("child_process");
const { getContractRootDir, newWindowBeside } = require("../helpers");

async function asmOptimizerActiveFile(args) {
  let activeDoc = vscode.window.activeTextEditor.document;
  let activeFile = activeDoc.fileName;

  if (activeFile.endsWith(".sol")) {
    const contractPathArray = activeFile.split("/"); //activeFile.substring(0, activeFile.length - 4);
    let contractName = contractPathArray[contractPathArray.length - 1];
    contractName = contractName.substring(0, contractName.length - 4);
    contractPathArray.pop();

    let contractDir = await getContractRootDir(contractPathArray.join("/"));

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

module.exports = { asmOptimizerActiveFile };
