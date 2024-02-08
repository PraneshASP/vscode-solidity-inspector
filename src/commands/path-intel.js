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

// class SolidityImportCompletionItemProvider {
//     constructor() {
//         this.filesCache = [];
//         this.lastCacheUpdate = Date.now();
//         this.remappings = {};
//         this.loadRemappings();
//         this.updateFilesCache(); // Initial cache update
//     }
//     async provideCompletionItems(document, position, token, context) {
//         const linePrefix = document.lineAt(position).text.substr(0, position.character);
//         if (!linePrefix.endsWith('import "') && !linePrefix.endsWith("import '")) {
//             return undefined;
//         }
    
//         const currentFilePath = document.uri.fsPath;
//         const cacheAge = Date.now() - this.lastCacheUpdate;
//         if (this.filesCache.length === 0 || cacheAge > 10000) { // 10 seconds cache timeout
//             await this.updateFilesCache();
//         }
        
//         return this.filesCache.map(filePath => {
//             const contractName = path.basename(filePath, '.sol');
//             console.log("contractName",contractName,filePath);
//             const relativeOrRemappedPath = this.getCompletionItemPath(filePath, currentFilePath);
//             console.log("contractName",contractName,filePath);

//             const insertText = `import {${contractName}} from "${relativeOrRemappedPath}";`;
    
//             const completionItem = new vscode.CompletionItem(contractName, vscode.CompletionItemKind.File);
//             completionItem.insertText = new vscode.SnippetString(insertText);
//             return completionItem;
//         });
//     }
    

//     async updateFilesCache() {
//         // Reset cache
//         this.filesCache = [];

//         // Define the glob pattern for Solidity files
//         const solidityFilesGlob = '**/*.sol';
//         // Exclude node_modules from the search
//         const excludePattern = '**/node_modules/**';

//         try {
//             const files = await vscode.workspace.findFiles(solidityFilesGlob, excludePattern);
//             this.filesCache = files.map(fileUri => vscode.workspace.asRelativePath(fileUri.path));

//             this.lastCacheUpdate = Date.now();
//         } catch (error) {
//             console.error('Error updating Solidity files cache:', error);
//         }
//     }
//     loadRemappings() {
//         const workspaceFolders = vscode.workspace.workspaceFolders;
//         if (!workspaceFolders) return;

//         const rootPath = workspaceFolders[0].uri.fsPath;
//         const remappingsPath = path.join(rootPath, 'remappings.txt');
//         if (fs.existsSync(remappingsPath)) {
//             const remappingsContent = fs.readFileSync(remappingsPath, 'utf8');
//             remappingsContent.split('\n').forEach(line => {
//                 const [key, val] = line.split('=');
//                 if (key && val) {
//                     this.remappings[key.trim()] = val.trim();
//                 }
//             });
//         }
//     }

//     getCompletionItemPath(fileUri, currentFilePath) {
//         try {
//             const relativePath = vscode.workspace.asRelativePath(fileUri);
//             if (!relativePath) {
//                 throw new Error('File is not within the workspace.');
//             }
//             const filePath = relativePath.replace(/\\/g, '/');
    
//             // Apply remappings
//             for (const [remappedPrefix, remappedValue] of Object.entries(this.remappings)) {
//                 if (filePath.startsWith(remappedValue)) {
//                     return filePath.replace(remappedValue, remappedPrefix);
//                 }
//             }
    
//             // Calculate relative path if not remapped
//             const currentDir = path.dirname(currentFilePath);
//             let finalPath = path.relative(currentDir, fileUri.fsPath).replace(/\\/g, '/');
//             if (!finalPath.startsWith('.')) {
//                 finalPath = './' + finalPath;
//             }
//             return finalPath;
//         } catch (error) {
//             console.error('Error while determining file path:', error.message);
//             // Return an empty string or handle the error as appropriate for your use case
//             return '';
//         }
//     }
    
    
//     async maybeUpdateCache() {
//         const cacheAge = Date.now() - this.lastCacheUpdate;
//         if (this.filesCache.length === 0 || cacheAge > 10000) { // E.g., 10 seconds cache timeout
//             await this.updateFilesCache();
//         }
//     }
// }

 

// module.exports = {SolidityImportCompletionItemProvider};


