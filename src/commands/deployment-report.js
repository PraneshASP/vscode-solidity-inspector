const vscode = require("vscode");
const fs = require("fs");
const Table = require('cli-table3');
const { networkMap } = require("../helpers");

function compressHash(txHash) {
    const first5 = txHash.substring(0, 5);
    const last5 = txHash.substring(txHash.length - 5);

    return first5 + "..." + last5; // Combine the first 5 and last 5 with an ellipsis in between.

}

async function createTableFromJson(file) {
    const filenameBlocks = file.split('/');
    const chainId = filenameBlocks[filenameBlocks.length - 2];
    const network = networkMap[chainId] || chainId;

    const filename = filenameBlocks[filenameBlocks.length - 1];
    const match = filename.match(/run-([0-9]+|latest)\.json/);

    let timestamp = match[1];
    if (timestamp == "latest") {
        let filestat = fs.statSync(file);
        timestamp = filestat.birthtime.toLocaleDateString();
    }
    else {
        timestamp = new Date(parseInt(timestamp) * 1000).toLocaleDateString();
    }

    // Read JSON content
    let rawContent = fs.readFileSync(file);
    let parsedContent;

    try {
        parsedContent = JSON.parse(rawContent);
    } catch (e) {
        vscode.window.showErrorMessage(`[Command failed] Invalid JSON format.`);
        return;
    }

    // For CREATE transactions
    const createTxTable = new Table({
        head: [{ content: `Transaction Type: CREATE` }, { content: `Network: ${network}` }, { content: `Date: ${timestamp}` }],
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗'
            , 'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝'
            , 'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼'
            , 'right': '║', 'right-mid': '╢', 'middle': '│'
        },
        wordWrap: true
    });
    createTxTable.push(['Contract Creation Hash', 'Contract Name', 'Contract Address']);


    // For CALL transactions
    const callTxTable = new Table({
        head: [{ content: `Transaction Type: CALL` }, { content: `Network: ${network}` }, { content: `Date: ${timestamp}` }],
        chars: {
            'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗'
            , 'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝'
            , 'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼'
            , 'right': '║', 'right-mid': '╢', 'middle': '│'
        },
        wordWrap: true,
        wrapOnWordBoundary: false,
        colWidths: [20, 25, 25, 30, 40]

    });
    callTxTable.push(['Tx Hash', 'Caller', 'To', 'Function Signature', "Arguments"]);
    // Populate tables
    parsedContent.transactions.forEach((tx) => {
        if (tx.hash != null) {  // Skip if tx.hash is empty
            if (tx.transactionType == "CREATE") {
                createTxTable.push([tx.hash, tx.contractName || 'N/A', tx.contractAddress || 'N/A']);
            }
            else if (tx.transactionType == "CALL") {
                callTxTable.push([compressHash(tx.hash), compressHash(tx.transaction.from) || 'N/A', tx.contractName || compressHash(tx.transaction.to) || 'N/A', tx.function || 'N/A', tx.arguments?.join(',\n') || 'N/A']);
            }
        }
    });

    return createTxTable.toString() + '\n\n' + callTxTable.toString();


}

async function generateDeploymentReportActiveFile(args) {
    let activeDoc = vscode.window.activeTextEditor.document;
    let activeFile = activeDoc.fileName;
    if (activeFile.endsWith(".json")) {
        const table = await createTableFromJson(activeFile);
        let outputChannel = vscode.window.createOutputChannel(
            "Deployment Report",
            'shell'
        );
        outputChannel.appendLine(table);
        outputChannel.show();
    } else {
        vscode.window.showErrorMessage(`[Command failed] ${activeFile}\n\nNot a valid deployment file.`);
    }

}

async function generateDeploymentReportContextMenu(clickedFile, selectedFiles) {
    for (let index = 0; index < selectedFiles.length; index++) {
        const activeFile = selectedFiles[index].path;
        if (!activeFile.endsWith(".json")) continue;
        const table = await createTableFromJson(activeFile);
        let outputChannel = vscode.window.createOutputChannel(
            "Deployment Report",
            'shell'
        );
        outputChannel.appendLine(table);
        outputChannel.show();

    }
}

module.exports = { generateDeploymentReportActiveFile, generateDeploymentReportContextMenu };
