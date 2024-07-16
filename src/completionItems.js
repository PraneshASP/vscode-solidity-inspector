const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

let remappings = null; // Cache remappings globally 

async function loadRemappings(rootPath) {
    const remappingsPath = path.join(rootPath, 'remappings.txt');
    try {
      const remappingsContent = await vscode.workspace.fs.readFile(vscode.Uri.file(remappingsPath));
      return remappingsContent.toString().split('\n').reduce((acc, line) => {
        const [key, val] = line.split('=');
        if (key && val) {
          acc[key.trim()] = val.trim();
        }
        return acc;
      }, {});
    } catch (error) {
      console.error('Error reading remappings:', error);
      return {};
    }
  }
  
  // Function to find all Solidity files in the current workspace
  async function findSolidityFiles() {
    const solidityFilePattern = '**/*.sol';
  
    return vscode.workspace.findFiles(solidityFilePattern)
      .then(files => files.map(file => file.fsPath));
  }
  
  // Function to extract contract and library names from a Solidity file
  function extractNames(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');  
    const names = [];
    const regex = /\b(contract|library|type|interface)\s+(\w+)/g; // Regex to match contract, library, type and interface definitions 
    let match;
  
    while ((match = regex.exec(fileContent)) !== null) {
      names.push(match[2]);
    }
  
    return names;
  }
  
  // Function to prepopulate an index of contract names and their corresponding file paths
  async function prepopulateIndex() {
    const solidityFiles = await findSolidityFiles();  
    const index = {};
  
    // Extract names from each file and populate the index
    solidityFiles.forEach(filePath => {
      const names = extractNames(filePath);
      names.forEach(name => {
        if (!index[name]) {
          index[name] = [];
        }
        index[name].push(filePath);
      });
    });
  
    return index;
  }
  
  
  // Function to provide import suggestions
  async function provideCompletionItems(document, position) {
    // Check if the current line starts with "import"
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    if (!linePrefix.startsWith('import')) {
      return undefined;
    }
  
    // Ensure a workspace folder is open
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return undefined;
  
    const rootPath = workspaceFolders[0].uri.fsPath;
  
    // Load remappings if not already loaded
    if (remappings === null) {
      remappings = await loadRemappings(rootPath);
    }
  
    const index = await prepopulateIndex();
    const currentFilePath = document.uri.fsPath;
    const currentDir = path.dirname(currentFilePath);
  
    const completionItems = Object.entries(index).flatMap(([name, filePaths]) => {
      return filePaths.map(filePath => {
        let finalPath = filePath.replace(rootPath + path.sep, ''); // Truncate rootPath
  
        // Apply remappings to the file path
        Object.entries(remappings).forEach(([key, value]) => {
          if (finalPath.startsWith(value)) {
            finalPath = finalPath.replace(value, key);
          }
        });
  
        if (finalPath === filePath) {
          // If no remapping was applied, make it a relative path
          finalPath = `./${path.relative(currentDir, filePath).split(path.sep).join('/')}`;
        }
  
        const completionItem = new vscode.CompletionItem(`${name} from "${finalPath}"`, vscode.CompletionItemKind.File);
        completionItem.insertText = `{ ${name} } from "${finalPath}";`;
  
        return completionItem;
      });
    });
  
    return completionItems;
  }
  
  function resetRemappings() {
    remappings = null;
  }
  
  module.exports = {resetRemappings, provideCompletionItems};