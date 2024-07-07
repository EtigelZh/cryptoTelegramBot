// import { ethers } from "ethers";
// import dotenv from 'dotenv';
// import { resolve } from "path";

// const defaultEnvPath = resolve(__dirname, '.env');
// dotenv.config({ path: defaultEnvPath });

// const ALCHEMY_API_KEY = process.env.ALCHEMY_API_TOKEN;
// const WEBSOCKET_URL = `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
// const HTTP_URL = `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`;

// let provider = new ethers.providers.WebSocketProvider(WEBSOCKET_URL);
// const httpProvider = new ethers.providers.JsonRpcProvider(HTTP_URL);

// const ERC20_ABI = [
//     "event Transfer(address indexed from, address indexed to, uint256 value)"
// ];

// const UNISWAP_V2_PAIR_ABI = [
//     "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
// ];

// const targetWalletAddress = "0xTargetWalletAddress"; // Замените на адрес целевого кошелька

// const trackTransfers = (contractAddress) => {
//     const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
//     contract.on("Transfer", (from, to, value, event) => {
//         if (from.toLowerCase() === targetWalletAddress.toLowerCase() || to.toLowerCase() === targetWalletAddress.toLowerCase()) {
//             console.log(`ERC-20 Transfer involving target wallet:`);
//             console.log(`From: ${from}`);
//             console.log(`To: ${to}`);
//             console.log(`Value: ${ethers.utils.formatUnits(value, 18)}`);
//             // console.log(event);
//         }
//     });
// };

// const trackSwaps = (pairAddress) => {
//     const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
//     pairContract.on("Swap", (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
//         if (sender.toLowerCase() === targetWalletAddress.toLowerCase() || to.toLowerCase() === targetWalletAddress.toLowerCase()) {
//             console.log(`Swap involving target wallet:`);
//             console.log(`Sender: ${sender}`);
//             console.log(`To: ${to}`);
//             console.log(`Amount0 In: ${ethers.utils.formatUnits(amount0In, 18)}`);
//             console.log(`Amount1 In: ${ethers.utils.formatUnits(amount1In, 18)}`);
//             console.log(`Amount0 Out: ${ethers.utils.formatUnits(amount0Out, 18)}`);
//             console.log(`Amount1 Out: ${ethers.utils.formatUnits(amount1Out, 18)}`);
//             // console.log(event);
//         }
//     });
// };

// const setupWebSocket = () => {
//     provider.on("block", async (blockNumber) => {
//         const block = await provider.getBlockWithTransactions(blockNumber);
//         console.warn(`New block received: ${blockNumber}`);
//         // console.log(block);

//         for (const tx of block.transactions) {
//             if (tx.to && (tx.to.toLowerCase() === targetWalletAddress.toLowerCase() || tx.from.toLowerCase() === targetWalletAddress.toLowerCase())) {
//                 console.log(`Transaction involving target wallet found: ${tx.hash}`);
//                 // console.log(tx);

//                 // Проверяем, является ли адрес контракта ERC-20 токеном
//                 try {
//                     console.log(`Checking if contract at ${tx.to} is an ERC-20 token contract...`);
//                     const code = await provider.getCode(tx.to);
//                     if (code !== '0x') {
//                         const contract = new ethers.Contract(tx.to, ERC20_ABI, provider);
//                         console.log(`Contract at ${tx.to} is a valid ERC-20 token contract.`);
//                         try {
//                             await contract.deployed();
//                             // Подписываемся на события Transfer для этого контракта
//                             console.log(`Tracking ERC-20 transfers for contract at ${tx.to}`)
//                             trackTransfers(tx.to);
//                         } catch (error) {
//                             console.log(`Contract at ${tx.to} is not a valid ERC-20 token contract.`);
//                         }
    
//                         // Проверяем, является ли адрес контракта парой Uniswap V2
//                         const pairContract = new ethers.Contract(tx.to, UNISWAP_V2_PAIR_ABI, provider);
//                         try {
//                             await pairContract.deployed();
//                             // Подписываемся на события Swap для этой пары
//                             console.log(`Tracking Uniswap V2 swaps for pair at ${tx.to}`);
//                             trackSwaps(tx.to);
//                         } catch (error) {
//                             console.log(`Contract at ${tx.to} is not a valid Uniswap V2 pair contract.`);
//                         }
//                     }
//                 } catch (e) {
//                     console.log(e);
//                 }
                
//             }
//         }
//     });

//     provider._websocket.on("error", async (error) => {
//         console.log(`WebSocket Error: ${error.message}`);
//     });

//     provider._websocket.on("close", async (code) => {
//         console.log(`WebSocket Closed: ${code}`);
//         // Реализуйте переподключение при закрытии соединения
//         console.log('Attempting to reconnect in 3 seconds...');
//         setTimeout(() => {
//             provider = new ethers.providers.WebSocketProvider(WEBSOCKET_URL);
//             setupWebSocket();
//         }, 3000);
//     });

//     console.log('WebSocket connection established, listening for ERC-20 transfers and swaps involving target wallet...');
// };

// setupWebSocket();
