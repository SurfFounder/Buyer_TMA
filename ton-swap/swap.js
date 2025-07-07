import { TonClient, toNano, Address } from "@ton/ton";
import { dexFactory, Client } from "@ston-fi/sdk";
import { StonApiClient, AssetTag } from '@ston-fi/api';
import fs from "fs";

const userWalletAddress = process.argv[2];
const offerAmount = process.argv[3];

// Используем mainnet endpoint вместо testnet
const tonApiClient = new Client({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
});

function logToFile(message) {
  fs.appendFileSync("swap.log", `[${new Date().toISOString()}] ${message}\n`);
}

async function main() {
  console.log("userWalletAddress:", userWalletAddress);
  console.log("offerAmount:", offerAmount);
  logToFile("userWalletAddress: " + userWalletAddress);
  logToFile("offerAmount: " + offerAmount);
  
  try {
    // 1. Инициализируем API клиент
    const client = new StonApiClient();
    
    // 2. Получаем список доступных активов
    const assetList = await client.queryAssets({
      condition: [
        AssetTag.LiquidityVeryHigh,
        AssetTag.LiquidityHigh,
        AssetTag.LiquidityMedium,
      ].join(' | ')
    });
    
    logToFile("Получен список активов: " + assetList.length);
    
    // 3. Находим TON и USDT
    const tonAsset = assetList.find(asset => asset.kind === 'Ton');
    const usdtAsset = assetList.find(asset => 
      asset.meta?.symbol === 'USDT' || 
      asset.meta?.displayName?.includes('USDT')
    );
    
    if (!tonAsset || !usdtAsset) {
      throw new Error("Не найдены необходимые активы (TON или USDT)");
    }
    
    logToFile("Найдены активы: TON и USDT");
    
    // 4. Конвертируем amount в правильные единицы
    const tonDecimals = 10 ** (tonAsset.meta?.decimals ?? 9);
    const offerUnits = (Number(offerAmount) * tonDecimals).toString();
    
    // 5. Симулируем swap
    const simulationResult = await client.simulateSwap({
      offerAddress: tonAsset.contractAddress,
      askAddress: usdtAsset.contractAddress,
      slippageTolerance: '0.01', // 1% slippage
      offerUnits,
    });
    
    logToFile("Симуляция успешна");
    
    // 6. Получаем метаданные роутера
    const routerMetadata = await client.getRouter(simulationResult.routerAddress);
    
    // 7. Создаем DEX контракты
    const dexContracts = dexFactory(routerMetadata);
    
    // 8. Открываем роутер
    const router = tonApiClient.open(
      dexContracts.Router.create(routerMetadata.address)
    );
    
    // 9. Получаем параметры транзакции для swap TON -> Jetton
    const txParams = await router.getSwapTonToJettonTxParams({
      userWalletAddress,
      proxyTon: dexContracts.pTON.create(routerMetadata.ptonMasterAddress),
      offerAmount: simulationResult.offerUnits,
      askJettonAddress: simulationResult.askAddress,
      minAskAmount: simulationResult.minAskUnits,
    });
    
    logToFile("Параметры транзакции получены успешно");
    
    // 10. Формируем результат в нужном формате
    const result = {
      to: txParams.to.toString(),
      value: txParams.value.toString(),
      body: txParams.body?.toBoc().toString("base64"),
      simulationResult: {
        offerUnits: simulationResult.offerUnits,
        minAskUnits: simulationResult.minAskUnits,
        routerAddress: simulationResult.routerAddress,
        expectedOutput: (Number(simulationResult.minAskUnits) / (10 ** (usdtAsset.meta?.decimals ?? 6))).toFixed(6)
      }
    };
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (e) {
    logToFile("Ошибка: " + e.toString());
    console.error("Ошибка:", e.message);
    throw e;
  }
}

main().catch(console.error);