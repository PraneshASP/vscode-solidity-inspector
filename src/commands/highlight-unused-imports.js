const vscode = require("vscode");

const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)'
});
function extractImports(importStatement) {
    const itemsRegex = /import\s*\{(.*?)\}\s*from.*/g;
    const fileRegex = /import\s*['"]([^'"]+)['"];/g;

    const itemsMatch = itemsRegex.exec(importStatement);
    if (itemsMatch) {
        // This was an import with named items.
        // Split the match into individual items, removing leading/trailing whitespace.
        const items = itemsMatch[1].split(',').map(item => {
            const parts = item.trim().split(/\s+as\s+/);
            return parts.length === 2 ? parts[1] : parts[0];
        });
        return items;
    } else {
        // This was an import with a file.
        const fileMatch = fileRegex.exec(importStatement);
        if (fileMatch) {
            // Extract the contract/file name from the path.
            const filePathParts = fileMatch[1].split('/');
            const fileNameParts = filePathParts[filePathParts.length - 1].split('.');
            const contractName = fileNameParts[0];
            return [contractName];
        } else {
            // This import statement didn't match either format.
            return [];
        }
    }
}

// Highlight unused imports for the active Solidity editor when the extension is activated
async function unusedImportsActiveFile(editor) {
    if (editor && editor.document.languageId == "solidity") {
        editor.setDecorations(decorationType, []);

        const text = editor.document.getText();

        const solhintRuleString = "solhint-disable no-unused-import"
        if (text.includes(solhintRuleString)) return;

        const importRegex = /import\s+((?:\{.+?\}\s+from\s+)?(?:\".*?\"|'.*?'));/g;
        const importStatements = text.match(importRegex) || [];
        const unusedImportDecorations = [];

        for (const importStatement of importStatements) {
            const imports = extractImports(importStatement);
            for (const item of imports) {
                const regex = new RegExp(`\\b${item}\\b`, 'g');
                const itemOccurrencesInImportStatement = (importStatement.replace(/\.sol\b/g, '').match(regex) || []).length;
                const totalOccurrencesOfItem = (text.match(new RegExp(`\\b${item}\\b`, 'gi')) || []).length;
                if (totalOccurrencesOfItem == itemOccurrencesInImportStatement) {
                    const lineIndex = editor.document.getText().split('\n').findIndex(line => line.includes(importStatement));
                    const range = new vscode.Range(editor.document.lineAt(lineIndex).range.start, editor.document.lineAt(lineIndex).range.end);

                    unusedImportDecorations.push({ range, ...{ hoverMessage: "Unused import" } });
                }
            }
        }
        editor.setDecorations(decorationType, unusedImportDecorations);
    }
}



module.exports = { unusedImportsActiveFile };
