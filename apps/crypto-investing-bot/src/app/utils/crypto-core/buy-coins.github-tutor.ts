import yargs from "yargs/yargs";
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { resolve } from "path";
import { swapTokens } from './buy-coins'; // Assuming the swapTokens function is in swapTokens.js

const defaultEnvPath = resolve(__dirname, '.env');
dotenv.config({ path: defaultEnvPath });

async function main() {
    const options = await yargs(hideBin(process.argv))
        .usage("Swaps tokens, based on Uniswap V3 SDK")
        .option("chain-id", { describe: "Chain id to work on", type: "string", demandOption: true })
        .option("wallet-address", { describe: "Your wallet address", type: "string", demandOption: true })
        .option("token-in-address", { describe: "Input token (that you'd spend) smart contract address", type: "string", demandOption: true })
        .option("token-out-address", { describe: "Output token (that you'd receive) smart contract address", type: "string", demandOption: true })
        .option("amount-in", { describe: "Input token amount to swap", type: "string", demandOption: true })
        .argv;

    const { chainId, walletAddress, tokenInAddress, tokenOutAddress, amountIn } = options;
    const { ALCHEMY_API_TOKEN = '', PRIVATE_KEY = '' } = process.env;

    try {
        await swapTokens({
            chainId: parseInt(chainId),
            walletAddress,
            tokenInAddress,
            tokenOutAddress,
            amountInStr: amountIn,
            alchemyApiToken: ALCHEMY_API_TOKEN,
            privateKey: PRIVATE_KEY
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();
