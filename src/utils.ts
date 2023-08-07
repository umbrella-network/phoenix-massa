/* eslint-disable  @typescript-eslint/no-non-null-assertion */
import { IDeploymentInfo } from '@massalabs/massa-sc-deployer';
import {
  EOperationStatus,
  IEvent,
  Client,
  DefaultProviderUrls,
  ClientFactory,
  WalletClient,
  Args,
  IAccount,
} from '@massalabs/massa-web3';
import { config } from 'dotenv-safe';
// import { TokenPair } from './serializables/tokenPair';

config({
  path: `.env`,
  example: `.env.example`,
});

export const getClient = async (): Promise<{
  client: Client;
  account: IAccount;
}> => {
  if (!process.env.WALLET_SECRET_KEY) {
    throw new Error('WALLET_SECRET_KEY env variable is not set');
  }
  const account = await WalletClient.getAccountFromSecretKey(
    process.env.WALLET_SECRET_KEY,
  );
  console.log('Using account: ', account.address);

  return {
    client: await ClientFactory.createDefaultClient(
      process.env.JSON_RPC_URL_PUBLIC as DefaultProviderUrls,
      false,
      account,
    ),
    account,
  };
};

export const getContractAddressfromDeploy = (
  deploy: IDeploymentInfo,
): string => {
  const deployedSCEvent = deploy.events?.find((e) =>
    e.data.includes('Contract deployed at address'),
  );

  if (!deployedSCEvent) {
    throw new Error('failed to retrieve deploy address');
  }

  return deployedSCEvent.data.substring(
    'Contract deployed at address: '.length,
    deployedSCEvent.data.length,
  );
};

export const waitOperationEvents = async (
  client: Client,
  opId: string,
): Promise<IEvent[]> => {
  await client
    .smartContracts()
    .awaitRequiredOperationStatus(opId, EOperationStatus.FINAL);
  console.log(`operation ${opId} is final`);

  const events: IEvent[] = await client
    .smartContracts()
    .getFilteredScOutputEvents({
      emitter_address: null,
      start: null,
      end: null,
      original_caller_address: null,
      original_operation_id: opId,
      is_final: true,
    });
  events.map((l) => console.log(`>>>> New event: ${l.data}`));
  return events;
};

// TODO: import from web3-utils
export function strToBytes(str: string): Uint8Array {
  if (!str.length) {
    return new Uint8Array(0);
  }
  return new Uint8Array(Buffer.from(str, 'utf-8'));
}
