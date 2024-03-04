import {
  Args,
  IDeserializedResult,
  ISerializable,
} from '@massalabs/massa-web3';

export class PriceData implements ISerializable<PriceData> {
  private data: number = 0; // u8
  private heartbeat: number = 0; // u32
  private timestamp: number = 0; // u32
  private price: bigint = BigInt(0); // u128

  constructor(data: number = 0, heartbeat: number = 0, timestamp: number = 0, price: bigint = BigInt(0)) {
    this.data = data;
    this.heartbeat = heartbeat;
    this.timestamp = timestamp;
    this.price = price;
  }

  serialize(): Uint8Array {
    let args = new Args()
        .addU8(this.data)
        .addU32(this.heartbeat)
        .addU32(this.timestamp)
        .addU128(BigInt(this.price));
    return new Uint8Array(args.serialize());
  }
  deserialize(data: Uint8Array, offset: number): IDeserializedResult<PriceData> {
    const args = new Args(data, offset);
    this.data = parseInt(args.nextU8().toString());
    this.heartbeat = args.nextU32();
    this.timestamp = args.nextU32();
    this.price = BigInt(parseInt(args.nextU128().toString()));
    return { instance: this, offset: args.getOffset() };
  }
}

export class LatestRoundData implements ISerializable<LatestRoundData> {

  private roundId: bigint;
  private answer: bigint;
  private startedAt: bigint;
  private updatedAt: bigint;
  private answeredInRound: bigint;

  constructor(roundId: bigint = 0n, answer: bigint = 0n, startedAt: bigint = 0n, updatedAt: bigint = 0n, answeredInRound: bigint = 0n) {
    this.roundId = roundId;
    this.answer = answer;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
    this.answeredInRound = answeredInRound;
  }

  serialize(): Uint8Array {
    let args = new Args()
        .addU64(this.roundId)
        .addU256(this.answer)
        .addU256(this.startedAt)
        .addU256(this.updatedAt)
        .addU64(this.answeredInRound)
    return new Uint8Array(args.serialize());
  }
  deserialize(data: Uint8Array, offset: number): IDeserializedResult<LatestRoundData> {
    const args = new Args(data, offset);
    this.roundId = args.nextU64();
    this.answer = args.nextU256();
    this.startedAt = args.nextU256();
    this.updatedAt = args.nextU256();
    this.answeredInRound = args.nextU64();
    return { instance: this, offset: args.getOffset() };
  }
}

