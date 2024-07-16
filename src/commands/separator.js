const vscode = require("vscode");

function createSeparator(style) {
    if (style === 'solmate') {
        return `    /*//////////////////////////////////////////////////////////////
                                \${1:PLACEHOLDER}
    //////////////////////////////////////////////////////////////*/\n`;
    } else { 
        return `    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         \${1:PLACEHOLDER}                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/\n`;
    }
}

function provideCompletionItemsForSeparator(document, position) {
    const linePrefix = document.lineAt(position).text.substr(0, position.character);

    if (linePrefix.endsWith('////')) {
        const soladyItem = new vscode.CompletionItem('Solady Separator', vscode.CompletionItemKind.Snippet);
        soladyItem.insertText = new vscode.SnippetString(createSeparator('solady'));
        soladyItem.detail = "Insert a Solady style separator \n" + createSeparator('solady');
        soladyItem.additionalTextEdits = [vscode.TextEdit.delete(new vscode.Range(position.translate(0, -4), position))];

        const solmateItem = new vscode.CompletionItem('Solmate Separator', vscode.CompletionItemKind.Snippet);
        solmateItem.insertText = new vscode.SnippetString(createSeparator('solmate'));
        solmateItem.detail = "Insert a Solmate style separator \n" + createSeparator('solmate');
        solmateItem.additionalTextEdits = [vscode.TextEdit.delete(new vscode.Range(position.translate(0, -4), position))];

        return [soladyItem, solmateItem];
    }

    return undefined;
}

function activate(context) {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'solidity', scheme: 'file' },
            { provideCompletionItems: provideCompletionItemsForSeparator },
            '/'
        )
    );
}

module.exports = {
    activate,
    provideCompletionItemsForSeparator
};