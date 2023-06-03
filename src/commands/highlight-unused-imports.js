const vscode = require("vscode");

const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)'
});
function extractImports(importStatement) {
    const itemsRegex = /import\s*\{(.*?)\}\s*from.*/;
    const fileRegex = /\/([^\/"]+)\.sol\";/;

    const itemsMatch = importStatement.match(itemsRegex);
    if (itemsMatch) {
        // This was an import with named items.
        // Split the match into individual items, removing leading/trailing whitespace.
        const items = itemsMatch[1].split(',').map(item => item.trim());
        return items;
    } else {
        // This was an import with a file.
        const fileMatch = importStatement.match(fileRegex);
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
        const importRegex = /import\s+((?:\{.+?\}\s+from\s+)?(?:\".*?\"|'.*?'));/g;
        const imports = text.match(importRegex) || [];


        const unusedImportDecorations = [];

        for (const importStatement of imports) {
            const imports = extractImports(importStatement);
            for (const item of imports) {
                const filePath = item;
                const regex = new RegExp(item, 'g');
                const itemOccurancesInImportStatement = (importStatement.replace(/\.sol\b/g, '').match(regex) || []).length;
                const occurrences = (text.match(new RegExp(filePath, 'g')) || []).length;


                if (occurrences == itemOccurancesInImportStatement) {
                    const lineIndex = editor.document.getText().split('\n').findIndex(line => line.includes(importStatement));
                    // console.log("lineIndex", lineIndex);
                    const range = new vscode.Range(editor.document.lineAt(lineIndex).range.start, editor.document.lineAt(lineIndex).range.end);

                    unusedImportDecorations.push({ range, ...{ hoverMessage: "Unused import" } });
                }
            }
        }
        editor.setDecorations(decorationType, unusedImportDecorations);
    }
}



module.exports = { unusedImportsActiveFile };
