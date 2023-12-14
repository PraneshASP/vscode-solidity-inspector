const vscode = require("vscode");

// Create a diagnostic collection
const treeFilesDiagnosticCollection = vscode.languages.createDiagnosticCollection('treeNodes');

// Register a Code Action provider
const treeFilesCodeActionProvider = vscode.languages.registerCodeActionsProvider('tree', {
    provideCodeActions(document) {
        const diagnostics = [];

        document.getText().split('\n').forEach((lineText, lineNumber) => {
            lineText = lineText.trim();
            if (/^(├──|└──|│)/.test(lineText)) {
                const allowedPrefixes = ['it', 'when', 'given'];
                lineText = lineText.replace(/^[^a-zA-Z0-9]+/, '');

                // Check if the line starts with an allowed prefix
                const prefix = lineText.split(' ')[0];
                if (!allowedPrefixes.includes(prefix)) {
                    // Create a diagnostic for the violation
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
                        `Tree node should start with "it", "when", or "given"`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            }

        });

        treeFilesDiagnosticCollection.set(document.uri, diagnostics);

    },
});

module.exports = { treeFilesDiagnosticCollection, treeFilesCodeActionProvider };
