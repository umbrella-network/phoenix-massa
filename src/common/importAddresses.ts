import {Args, ArrayTypes, Client} from "@massalabs/massa-web3";
import {Bytes32} from "../serializables/bytes32";
import {wBytes} from "../serializables/wBytes";
import {DeployedContracts, getDeployedContracts} from "./deployed";
import {getDynamicCosts} from "../utils";

export async function importAddresses(client: Client, contractName: keyof DeployedContracts): Promise<string> {
  const deployed = getDeployedContracts();
  const bank_name = 'StakingBank';

  let contract_name: Uint8Array = new Bytes32()
    .addString(contractName.startsWith(bank_name) ? 'STAKING_BANK' : contractName).serialize();
  let _names: Array<wBytes> = [new wBytes(contract_name)];
  let _destinations: Array<string> = [deployed[contractName]];
  // console.log("_destinations", _destinations, _destinations.length);
  let importAddressesArgs = new Args();
  // add _names
  importAddressesArgs.addSerializableObjectArray(_names);
  // add _destinations
  importAddressesArgs.addArray(_destinations, ArrayTypes.STRING);
  // console.log("importAddressesArgs");
  // console.log(importAddressesArgs);

  const deployerAccount = client.wallet().getBaseAccount()!;
  const targetFunction: string = "importAddresses";

  let [estimated_gas, estimated_storage_cost] = await getDynamicCosts(
      client, deployed.Registry, targetFunction, importAddressesArgs.serialize());
  // console.log(`Estimated gas: ${estimated_gas}`);
  // console.log(`Estimated sto: ${estimated_storage_cost}`);

  return client.smartContracts().callSmartContract(
    {
      fee: 0n,
      maxGas: estimated_gas,
      coins: BigInt(estimated_storage_cost),
      targetAddress: deployed.Registry,
      functionName: targetFunction,
      parameter: importAddressesArgs.serialize(),
    },
    deployerAccount,
  )
}
