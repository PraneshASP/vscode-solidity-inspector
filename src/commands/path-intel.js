const vscode = require("vscode");
const path = require("path");
const fs = require("fs");


function pathIntel(context) {
    let disposable = vscode.commands.registerCommand("vscode-solidity-inspector" + ".pathIntel", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }

        const document = editor.document;
        const position = editor.selection.start;
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const match = linePrefix.match(/import\s+([A-Za-z0-9_]*)$/);

        if (!match) {
            return; // No matching pattern
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return; // No workspace folder open
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const remappingsPath = path.join(rootPath, 'remappings.txt');
        let remappings = {};

        // Read and parse the remappings file
        if (fs.existsSync(remappingsPath)) {
            const remappingsContent = fs.readFileSync(remappingsPath, 'utf8');
            remappingsContent.split('\n').forEach(line => {
                const [key, val] = line.split('=');
                remappings[key.trim()] = val.trim();
            });
        }

        const searchPattern = match[1] + '*.sol';
        const solidityFiles = await vscode.workspace.findFiles('**/' + searchPattern, '**/node_modules/**', 100);
        const filteredPaths = solidityFiles.map(file => {
            const relativePath = vscode.workspace.asRelativePath(file.path).replace(/\\/g, '/');
            return {
                label: path.basename(file.path),
                description: relativePath,
                fullPath: file.path
            };
        });

        const pickedFile = await vscode.window.showQuickPick(filteredPaths, {
            placeHolder: 'Select a file',
            matchOnDescription: true
        });

        if (pickedFile) {
            let finalPath = vscode.workspace.asRelativePath(pickedFile.fullPath).replace(/\\/g, '/');
            let isRemapped = false;

            // Apply remappings
            Object.entries(remappings).forEach(([key, value]) => {
                if (finalPath.startsWith(value)) {
                    finalPath = `${key}${finalPath.substring(value.length)}`;
                    isRemapped = true;
                }
            });

            if (!isRemapped) {
                // Calculate the relative path for non-remapped imports
                const currentFileDir = path.dirname(document.uri.fsPath);
                finalPath = path.relative(currentFileDir, pickedFile.fullPath).replace(/\\/g, '/');
                if (!finalPath.startsWith('.')) {
                    finalPath = './' + finalPath; // Ensure it's recognized as a relative path
                }
            }

            const contractName = path.basename(pickedFile.label, '.sol');
            const importStatement = `import {${contractName}} from "${finalPath}";`;

            editor.edit(editBuilder => {
                editBuilder.replace(new vscode.Range(position.line, 0, position.line, linePrefix.length), importStatement);
            });
        }
    });

    
    context.subscriptions.push(disposable);
}

module.exports = {pathIntel};

 