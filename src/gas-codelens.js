const vscode = require("vscode");
const fs = require("fs");

class GasAnalysisCodeLensProvider {
    constructor() {
        this.onDidChangeCodeLensesEventEmitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this.onDidChangeCodeLensesEventEmitter.event;
    }

    refresh() {
        this.onDidChangeCodeLensesEventEmitter.fire();
    }

    provideCodeLenses(document, token) {
        if (!document.fileName.endsWith('.t.sol') && !document.fileName.endsWith('Test.sol')) {
            return [];
        }

        const codeLenses = [];
        const text = document.getText();
        const lines = text.split('\n');

        let contractLineNumber = null;
        let contractName = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Find contract declaration with "Test" in the name
            const contractMatch = line.match(/contract\s+(\w*Test\w*)/);
            if (contractMatch) {
                contractName = contractMatch[1];
                contractLineNumber = i;

                // Add CodeLens for all tests and current file tests
                const range = new vscode.Range(i, 0, i, line.length);
                
                codeLenses.push(new vscode.CodeLens(range, {
                    title: "Gas Analysis",
                    command: "vscode-solidity-inspector.codelens.gasAnalysisAll"
                }));

                codeLenses.push(new vscode.CodeLens(range, {
                    title: "Gas Analysis(this)",
                    command: "vscode-solidity-inspector.codelens.gasAnalysisFile",
                    arguments: [contractName]
                }));
            }

            // Find test function declarations
            const testMatch = line.match(/function\s+(test\w+)\s*\(/);
            if (testMatch && contractName) {
                const testFunctionName = testMatch[1];
                const range = new vscode.Range(i, 0, i, line.length);

                codeLenses.push(new vscode.CodeLens(range, {
                    title: `Gas Analysis - ${testFunctionName}`,
                    command: "vscode-solidity-inspector.codelens.gasAnalysisTest",
                    arguments: [testFunctionName]
                }));
            }
        }

        return codeLenses;
    }

    resolveCodeLens(codeLens, token) {
        return codeLens;
    }
}

module.exports = { GasAnalysisCodeLensProvider };