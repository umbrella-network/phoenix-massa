import {readFileSync, writeFileSync} from "fs";
import path from "path";
import {fileURLToPath} from "url";


export type DeployedContracts = {
  Registry: string;
  StakingBankStaticDev: string;
  UmbrellaFeeds: string;
  UmbrellaFeedsReaderFactory: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const file = __dirname + `/../deployed_${process.env.MASSA_NETWORK!}.json`;

export function getDeployedContracts(): DeployedContracts {
  const jsonString = readFileSync(file, "utf-8");
  return jsonString ? JSON.parse(jsonString) : {};
}

export function saveDeployedContracts(data: DeployedContracts): void {
  writeFileSync(file, JSON.stringify(data, null, 2));
}
