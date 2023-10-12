import {readFileSync} from "fs";
import path from "path";
import {fileURLToPath} from "url";


export type DeployedContracts = {
  Registry: string;
  StakingBankStaticDev: string;
  UmbrellaFeeds:string;
}

export function getDeployedContracts(): DeployedContracts {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(path.dirname(__filename));
  const jsonString = readFileSync(__dirname + '/../deployed.json', "utf-8");

  return JSON.parse(jsonString);
}
