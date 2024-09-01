const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let decorationType;
let workspaceRoot;
let foundryOutDir = 'out';  
let hardhatOutDir = null;  

function activate(context) {
    console.info('contract-size: Activating extension');
    workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    console.info('contract-size: Workspace root:', workspaceRoot);

    loadConfig();

    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            textDecoration: 'none; opacity: 0.7;'
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'solidity' && isNotScriptOrTest(event.document.fileName)) {
                updateDecorations(event.document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor?.document.languageId === 'solidity' && isNotScriptOrTest(editor.document.fileName)) {
                updateDecorations(editor.document);
            }
        })
    );

    if (vscode.window.activeTextEditor?.document.languageId === 'solidity' && 
        isNotScriptOrTest(vscode.window.activeTextEditor.document.fileName)) {
        updateDecorations(vscode.window.activeTextEditor.document);
    }

    console.info('contract-size: Activation complete');
}

function isNotScriptOrTest(fileName) {
    return fileName.endsWith('.sol') && !fileName.endsWith('.t.sol') && !fileName.endsWith('.s.sol');
}

function loadConfig() {
    const foundryConfigPath = path.join(workspaceRoot, 'foundry.toml');

    if (fs.existsSync(foundryConfigPath)) {
        console.info('contract-size: Foundry configuration detected');
        const configContent = fs.readFileSync(foundryConfigPath, 'utf8');
        const outDirMatch = configContent.match(/out\s*=\s*['"](.+)['"]/);
        if (outDirMatch) {
            foundryOutDir = outDirMatch[1];
        }
        console.info(`contract-size: Using Foundry out directory: ${foundryOutDir}`);
    }

    // Search for Hardhat artifacts directory
    hardhatOutDir = findArtifactsDir(workspaceRoot);
    if (hardhatOutDir) {
        console.info(`contract-size: Hardhat artifacts directory found: ${hardhatOutDir}`);
    } else {
        console.info('contract-size: Hardhat artifacts directory not found');
    }
}

function findArtifactsDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file === 'artifacts') {
                return filePath;
            } else {
                const result = findArtifactsDir(filePath);
                if (result) return result;
            }
        }
    }
    return null;
}

function updateDecorations(document) {
    const config = vscode.workspace.getConfiguration('solidityInspector');
    const showContractSize = config.get('showContractSize');

    if (!showContractSize || !isNotScriptOrTest(document.fileName)) {
        // Clear decorations if the feature is disabled or it's not a regular .sol file
        vscode.window.activeTextEditor?.setDecorations(decorationType, []);
        return;
    }

    const text = document.getText();
    const contractSizes = getContractSizes(document.fileName);
    const decorations = [];

    const contractRegex = /contract\s+(\w+)(?:\s+is\s+[^{]+)?\s*{/g;
    let match;
    while ((match = contractRegex.exec(text)) !== null) {
        const contractName = match[1];
        const size = contractSizes[contractName];
        if (size) {
            const pos = document.positionAt(match.index);
            const range = document.lineAt(pos.line).range;
            decorations.push({
                range,
                renderOptions: {
                    after: {
                        contentText: ` [${formatSize(size)}]`,
                        color: getSizeColor(size),
                    }
                }
            });
        }
    }

    vscode.window.activeTextEditor?.setDecorations(decorationType, decorations);
}

function getContractSizes(fileName) {
    const sizes = {};
    const contractName = path.basename(fileName, '.sol');

    // Paths for both Foundry and Hardhat
    const foundryJsonPath = path.join(workspaceRoot, foundryOutDir, `${path.basename(fileName)}`, `${contractName}.json`);
    let hardhatJsonPath = null;
    if (hardhatOutDir) {
        const relativePath = path.relative(workspaceRoot, fileName);
        hardhatJsonPath = path.join(hardhatOutDir, relativePath, `${contractName}.json`);
    }

    const jsonPaths = [foundryJsonPath, hardhatJsonPath].filter(Boolean);
     for (const jsonPath of jsonPaths) {
        try {
            if (fs.existsSync(jsonPath)) {
                const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                const bytecode = jsonPath === hardhatJsonPath ? jsonContent.deployedBytecode : jsonContent.deployedBytecode.object;
                sizes[contractName] = (bytecode.slice(2).length) / 2;
                console.info(`contract-size: Size calculated for ${contractName} from ${jsonPath}`);
                break; // Stop after finding the first valid file
            }
        } catch (error) {
            console.error(`contract-size: Error reading or parsing JSON for ${contractName} at ${jsonPath}:`, error);
        }
    }

    if (!sizes[contractName]) {
        console.info(`contract-size: JSON file not found for ${contractName} in any expected location`);
    }

    return sizes;
}

function formatSize(bytes) {
    return `${(bytes / 1024).toFixed(2)} KB`;
}

function getSizeColor(bytes) {
    const kb = bytes / 1024;
    if (kb > 22) return '#FF4136';
    if (kb > 20) return '#FFDC00';
    return '#2ECC40';
}

module.exports = {
    activate
};