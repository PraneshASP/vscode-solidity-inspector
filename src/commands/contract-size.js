const vscode = require('vscode');
const solc = require('solc');
const path = require('path');
const fs = require('fs');

let decorationType;
let workspaceRoot;
let remappings = [];

function activate(context) {
    console.log('contract-size: Activating extension');
    workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    console.log('contract-size: Workspace root:', workspaceRoot);

    loadRemappings();

    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            textDecoration: 'none; opacity: 0.7;'
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'solidity') {
                updateDecorations(event.document);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor?.document.languageId === 'solidity') {
                updateDecorations(editor.document);
            }
        })
    );

    if (vscode.window.activeTextEditor?.document.languageId === 'solidity') {
        updateDecorations(vscode.window.activeTextEditor.document);
    }

    console.log('contract-size: Activation complete');
}

function loadRemappings() {
    const remappingsPath = path.join(workspaceRoot, 'remappings.txt');
    console.log('contract-size: Looking for remappings at:', remappingsPath);
    if (fs.existsSync(remappingsPath)) {
        const content = fs.readFileSync(remappingsPath, 'utf8');
        remappings = content.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                const [from, to] = line.split('=');
                return { from: from.trim(), to: to.trim() };
            });
        console.log('contract-size: Loaded remappings:', remappings);
    } else {
        console.log('contract-size: No remappings.txt found');
    }
}

function updateDecorations(document) {
    const text = document.getText();
    const contractSizes = compileAndGetSizes(document.fileName, text);
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
                        contentText: ` (${formatSize(size)})`,
                        color: getSizeColor(size),
                    }
                }
            });
        }
    }

    vscode.window.activeTextEditor?.setDecorations(decorationType, decorations);
}

function compileAndGetSizes(fileName, source) {
    const input = {
        language: 'Solidity',
        sources: { [fileName]: { content: source } },
        settings: { outputSelection: { '*': { '*': ['evm.bytecode'] } } }
    };

    try {
        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
        if (output.errors?.some(error => error.severity === 'error')) {
            console.error('contract-size: Compilation errors:', output.errors);
            return {};
        }

        const sizes = {};
        for (const [, contracts] of Object.entries(output.contracts)) {
            for (const [name, contract] of Object.entries(contracts)) {
                sizes[name] = contract.evm.bytecode.object.length / 2;
            }
        }
        return sizes;
    } catch (error) {
        console.error('contract-size: Compilation failed:', error);
        return {};
    }
}

function findImports(importPath) {
    console.log('contract-size: Resolving import:', importPath);
    for (const remap of remappings) {
        if (importPath.startsWith(remap.from)) {
            const remappedPath = importPath.replace(remap.from, remap.to);
            const fullPath = path.resolve(workspaceRoot, remappedPath);
            if (fs.existsSync(fullPath)) {
                console.log('contract-size: Resolved import via remappings:', fullPath);
                return { contents: fs.readFileSync(fullPath, 'utf8') };
            }
        }
        else {
            console.log('contract-size: Resolved import without remappings:', importPath);
            return { contents: fs.readFileSync(importPath, 'utf8') };
        }
    }
   
}

function formatSize(bytes) {
    return `${(bytes / 1024).toFixed(2) / 2} KB`;
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