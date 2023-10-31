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



module.exports = { newWindowBeside, getContractRootDir, LANGID, networkMap };
