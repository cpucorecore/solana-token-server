"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ioredis_1 = __importDefault(require("ioredis"));
const node_cache_1 = __importDefault(require("node-cache"));
const umi_bundle_defaults_1 = require("@metaplex-foundation/umi-bundle-defaults");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
const mpl_token_metadata_2 = require("@metaplex-foundation/mpl-token-metadata");
const umi_1 = require("@metaplex-foundation/umi");
const umi = (0, umi_bundle_defaults_1.createUmi)(process.env.TOKEN_SERVER_SOLANA_ENDPOINT || 'https://api.mainnet-beta.solana.com').use((0, mpl_token_metadata_1.mplTokenMetadata)());
const redis = new ioredis_1.default(process.env.TOKEN_SERVER_REDIS_URL || 'localhost:6379');
const localCache = new node_cache_1.default();
class Token {
    constructor(address, name, symbol, decimals, supply) {
        this.address = address;
        this.name = name;
        this.symbol = symbol;
        this.decimals = decimals;
        this.supply = supply;
    }
}
const TokenKeyPrefix = 't:';
function getTokenByMint(mint) {
    return __awaiter(this, void 0, void 0, function* () {
        let data;
        let key = TokenKeyPrefix + mint;
        // get from local cache
        data = localCache.get(key);
        if (data) {
            return data;
        }
        // get from redis
        data = yield redis.get(key);
        if (data) {
            const token = JSON.parse(data);
            localCache.set(key, token, 3600);
            return token;
        }
        // get by metaplex api
        const mintAddr = (0, umi_1.publicKey)(mint);
        const digitalAsset = yield (0, mpl_token_metadata_2.fetchDigitalAsset)(umi, mintAddr);
        console.log("sb");
        data = new Token(digitalAsset.publicKey, digitalAsset.metadata.name, digitalAsset.metadata.symbol, digitalAsset.mint.decimals, digitalAsset.mint.supply.toString());
        const jsonData = JSON.stringify(data);
        redis.set(key, jsonData);
        localCache.set(key, data, 3600);
        return data;
    });
}
const app = (0, express_1.default)();
let tokenNull = new Token('', '', '', 0, '');
let resp = { status: 0, err: '', token: tokenNull };
app.get('/token/:mint', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let mint = req.params.mint;
    try {
        let token = yield getTokenByMint(mint);
        resp.status = 0;
        resp.err = '';
        resp.token = token;
        res.json(resp);
    }
    catch (err) {
        console.error(err);
        resp.status = 1;
        resp.err = JSON.stringify(err);
        resp.token = tokenNull;
        res.status(500).json(resp);
    }
}));
app.listen(process.env.TOKEN_SERVER_PORT || 11118, () => {
    console.log(`Server is running...`);
});
