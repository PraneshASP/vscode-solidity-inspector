const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const LANGID = "solidity";

function getContractRootDir(currentDir) {
  while (
    !fs.existsSync(path.join(currentDir, "foundry.toml")) &&
    !fs.existsSync(path.join(currentDir, "hardhat.config.js")) &&
    !fs.existsSync(path.join(currentDir, "hardhat.config.ts"))
  ) {
    currentDir = path.join(currentDir, "..");
  }

  return currentDir;
}

function newWindowBeside(content) {
  vscode.workspace
    .openTextDocument({ content: content, language: LANGID })
    .then((doc) =>
      vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside)
    );
}


async function provideCompletionItems(document, position) {
  const linePrefix = document.lineAt(position).text.substring(0, position.character);
  if (!linePrefix.startsWith('import')) {
    return undefined;
  }

  // Step 1: Read and parse remappings
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return undefined; // No workspace folder open

  const rootPath = workspaceFolders[0].uri.fsPath;
  const remappingsPath = path.join(rootPath, 'remappings.txt');
  let remappings = {};

  if (fs.existsSync(remappingsPath)) {
    const remappingsContent = fs.readFileSync(remappingsPath, 'utf8');
    remappingsContent.split('\n').forEach(line => {
      const [key, val] = line.split('=');
      remappings[key.trim()] = val.trim();
    });
  }

  // Step 2: Apply remappings to import paths
  const solidityFiles = await findSolidityFiles();
  const currentFilePath = document.uri.fsPath;
  const currentDir = path.dirname(currentFilePath);


  const completionItems = solidityFiles.map(file => {
    let filePath = vscode.workspace.asRelativePath(file, false);
    let remappedPath = filePath; // Start with the original path

    // Apply remappings
    Object.entries(remappings).forEach(([key, value]) => {
      if (filePath.startsWith(value)) {
        // Replace the matching part of the path with the remapping key
        remappedPath = filePath.replace(value, key);
      }
    });

    // Determine if the path was remapped
    const isRemapped = remappedPath !== filePath;

    // Use the remapped path if available, otherwise use the relative path
    const finalPath = isRemapped ? remappedPath : `./${path.relative(currentDir, file).split(path.sep).join('/')}`;

    const contractName = path.basename(file, '.sol');
    const completionItem = new vscode.CompletionItem(`${contractName} from "${finalPath}"`, vscode.CompletionItemKind.File);

    // Format the insert text based on whether the path was remapped
    completionItem.insertText = `{${contractName}} from "${finalPath}";`;

    return completionItem;
  });
  return completionItems;
}

function findSolidityFiles() {
  // Define the glob pattern for Solidity files
  const solidityFilePattern = '**/*.sol';
  // Exclude files from the node_modules folder 
  const excludePattern = '**/node_modules/**';

  // Use findFiles to search for files matching the Solidity pattern, excluding undesired paths
  return vscode.workspace.findFiles(solidityFilePattern, excludePattern)
    .then(files => files.map(file => file.fsPath)); // Convert URIs to file system paths

}

const networkMap = {
  "1": "Ethereum",
  "8": "Ubiq",
  "10": "Optimism",
  "19": "Songbird",
  "20": "Elastos",
  "24": "KardiaChain",
  "25": "Cronos",
  "30": "RSK",
  "40": "Telos",
  "50": "XDC",
  "52": "CSC",
  "55": "ZYX",
  "56": "Binance",
  "57": "Syscoin",
  "60": "Gochain",
  "61": "Ethereum Classic",
  "66": "OKExChain",
  "70": "Hoo",
  "82": "Meter",
  "87": "Nova Network",
  "88": "TomoChain",
  "100": "xDAI",
  "106": "Velas",
  "108": "ThunderCore",
  "122": "Fuse",
  "128": "Heco",
  "137": "Polygon",
  "200": "xDaiArb",
  "204": "Op_BNB",
  "246": "EnergyWeb",
  "248": "Oasys",
  "250": "Fantom",
  "269": "HPB",
  "288": "Boba",
  "311": "Omax",
  "314": "Filecoin",
  "321": "KuCoin",
  "324": "Era",
  "336": "Shiden",
  "361": "Theta",
  "369": "Pulse",
  "416": "SX",
  "534": "Candle",
  "570": "Rollux",
  "592": "Astar",
  "820": "Callisto",
  "888": "Wanchain",
  "1088": "Metis",
  "1101": "Polygon_zkEVM",
  "1116": "Core",
  "1231": "Ultron",
  "1234": "Step",
  "1284": "Moonbeam",
  "1285": "Moonriver",
  "1440": "Living Assets Mainnet",
  "1559": "Tenet",
  "1975": "Onus",
  "2000": "Dogechain",
  "2222": "Kava",
  "2332": "Soma",
  "4689": "IoTeX",
  "5000": "Mantle",
  "5050": "XLC",
  "5551": "Nahmii",
  "6969": "Tombchain",
  "7700": "Canto",
  "8217": "Klaytn",
  "8453": "Base",
  "9001": "Evmos",
  "9790": "Carbon",
  "10000": "SmartBCH",
  "15551": "Loop",
  "17777": "EOS EVM",
  "32520": "Bitgert",
  "32659": "Fusion",
  "32769": "Zilliqa",
  "42161": "Arbitrum",
  "42170": "Arbitrum Nova",
  "42220": "Celo",
  "42262": "Oasis",
  "43114": "Avalanche",
  "47805": "Rei",
  "55555": "ReiChain",
  "59144": "Linea",
  "71402": "Godwoken",
  "333999": "Polis",
  "420420": "Kekchain",
  "888888": "Vision",
  "245022934": "Neon",
  "1313161554": "Aurora",
  "1666600000": "Harmony",
  "11297108109": "Palm",
  "836542336838601": "Curio",
};



module.exports = { newWindowBeside, getContractRootDir, LANGID, networkMap, provideCompletionItems, findSolidityFiles };
