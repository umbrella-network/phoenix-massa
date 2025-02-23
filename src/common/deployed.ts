import {readFileSync, writeFileSync} from "fs";
import path from "path";
import {fileURLToPath} from "url";


export type DeployedContracts = {
  Registry: string;
  StakingBankStatic: string;
  UmbrellaFeeds: string;
  UmbrellaFeedsReaderFactory: string;
}

if (!process.env.ENV) throw new Error('set ENV to: dev, sbx, prod');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));
const env = (process.env.ENV ?? 'dev').toLowerCase();
const file = __dirname + `/../deployed_${env}.json`;

export function getDeployedContracts(): DeployedContracts {
  const jsonString = readFileSync(file, "utf-8");
  return jsonString ? JSON.parse(jsonString) : {};
}

export function saveDeployedContracts(data: DeployedContracts): void {
  writeFileSync(file, JSON.stringify(data, null, 2));
}
