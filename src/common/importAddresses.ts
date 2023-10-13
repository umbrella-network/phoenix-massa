import {Args, ArrayTypes, Client} from "@massalabs/massa-web3";
import {Bytes32} from "../serializables/bytes32";
import {wBytes} from "../serializables/wBytes";
import {DeployedContracts, getDeployedContracts} from "./deployed";

export async function importAddresses(client: Client, contractName: keyof DeployedContracts): Promise<string> {
  const deployed = getDeployedContracts();

  let bank_name: Uint8Array = new Bytes32().addString(contractName).serialize();
  let _names: Array<wBytes> = [new wBytes(bank_name)];
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

  return client.smartContracts().callSmartContract(
    {
      fee: 0n,
      maxGas: 70_000_000n,
      // coins: 1_000_000_000n,
      coins: 0n,
      targetAddress: deployed.Registry,
      functionName: 'importAddresses',
      parameter: importAddressesArgs.serialize(),
    },
    deployerAccount,
  )
}
