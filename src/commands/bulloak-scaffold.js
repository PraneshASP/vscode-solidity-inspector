const vscode = require("vscode");
const cp = require("child_process");
const { newWindowBeside } = require("../helpers");

async function scaffoldActiveFile(args) {
    let activeDoc = vscode.window.activeTextEditor.document;
    let activeFile = activeDoc.fileName;
    if (activeFile.endsWith(".tree")) {
        const filePathArray = activeFile.split("/");
        let fileName = filePathArray[filePathArray.length - 1];
        fileName = fileName.substring(0, fileName.length - 4);
        filePathArray.pop();
        let activeFileDirArray = activeFile.split('/');
        activeFileDirArray.pop();
        let activeFileDir = activeFileDirArray.join("/");
        cp.exec(
            `cd ${activeFileDir} && bulloak scaffold ${fileName}tree`,
            (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showErrorMessage(
                        `[Operation failed] \n${err.message}\n\nNOTE: Please make sure to install 'bulloak' before using this command`
                    );
                    console.error(err);
                }
                newWindowBeside(stdout);
            }
        );
    } else {
        vscode.window.showErrorMessage(
            `[Operation failed] ${activeFile}\n\nOnly .tree files are supported.`
        );
    }
}

async function scaffoldContextMenu(clickedFile, selectedFiles) {
    for (let index = 0; index < selectedFiles.length; index++) {
        const activeFile = selectedFiles[index].path;
        if (!activeFile.endsWith(".tree")) continue;
        const filePathArray = activeFile.split("/");
        let fileName = filePathArray[filePathArray.length - 1];
        fileName = fileName.substring(0, fileName.length - 4);

        filePathArray.pop();

        let activeFileDirArray = activeFile.split('/');
        activeFileDirArray.pop();
        let activeFileDir = activeFileDirArray.join("/");
        cp.exec(
            `cd ${activeFileDir} && bulloak scaffold ${fileName}tree`,
            (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showErrorMessage(
                        `[Operation failed] \n${err.message}\n\nNOTE: Please make sure to install 'bulloak' before using this command`
                    );
                }
                newWindowBeside(stdout);
            }
        );
    }
}

module.exports = { scaffoldActiveFile, scaffoldContextMenu };
