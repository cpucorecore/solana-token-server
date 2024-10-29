import express from "express";
import Redis from "ioredis";
import NodeCache from "node-cache";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fetchDigitalAsset,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";

const umi = createUmi(
  process.env.TOKEN_SERVER_SOLANA_ENDPOINT ||
    "https://api.mainnet-beta.solana.com",
).use(mplTokenMetadata());
const redis = new Redis(process.env.TOKEN_SERVER_REDIS_URL || "localhost:6379");
const localCache = new NodeCache();

class Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;

  constructor(
    address: string,
    name: string,
    symbol: string,
    decimals: number,
    supply: string,
  ) {
    this.address = address;
    this.name = name;
    this.symbol = symbol;
    this.decimals = decimals;
    this.supply = supply;
  }
}

const TokenKeyPrefix = "t:";

async function getTokenByMint(mint: string): Promise<Token> {
  let data;
  let key = TokenKeyPrefix + mint;
  // get from local cache
  data = localCache.get(key);
  if (data) {
    return data as Token;
  }

  // get from redis
  data = await redis.get(key);
  if (data) {
    const token = JSON.parse(data);
    localCache.set(key, token, 3600);
    return token;
  }

  // get by metaplex api
  const mintAddr = publicKey(mint);
  const digitalAsset = await fetchDigitalAsset(umi, mintAddr);

  data = new Token(
    digitalAsset.publicKey,
    digitalAsset.metadata.name,
    digitalAsset.metadata.symbol,
    digitalAsset.mint.decimals,
    digitalAsset.mint.supply.toString(),
  );
  const jsonData = JSON.stringify(data);
  redis.set(key, jsonData);
  localCache.set(key, data, 3600);

  return data;
}

const app = express();

interface Resp {
  status: number;
  err: string;
  token: Token;
}

let tokenNull: Token = new Token("", "", "", 0, "");
let resp: Resp = { status: 0, err: "", token: tokenNull };

app.get("/token/:mint", async (req, res) => {
  let mint = req.params.mint;
  try {
    let token = await getTokenByMint(mint);

    resp.status = 0;
    resp.err = "";
    resp.token = token;
    res.json(resp);
  } catch (err) {
    console.error(err);
    resp.status = 1;
    resp.err = JSON.stringify(err);
    resp.token = tokenNull;
    res.status(500).json(resp);
  }
});

app.listen(process.env.TOKEN_SERVER_PORT || 11118, () => {
  console.log(`Server is running...`);
});
