const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const LANGID = "solidity";

function getContractRootDir(currentDir) {
  while (
    !fs.existsSync(path.join(currentDir, "foundry.toml")) &&
    !fs.existsSync(path.join(currentDir, "hardhat.config.js")) &&
    !fs.existsSync(path.join(currentDir, "hardhat.config.ts"))
  ) {
    currentDir = path.join(currentDir, "..");
  }

  return currentDir;
}

function newWindowBeside(content) {
  vscode.workspace
    .openTextDocument({ content: content, language: LANGID })
    .then((doc) =>
      vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    );
}

module.exports = { newWindowBeside, getContractRootDir, LANGID };
