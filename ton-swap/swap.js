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
    
    // Отладка: выводим все активы
    console.log("Доступные активы:");
    assetList.forEach((asset, index) => {
      console.log(`${index}: ${asset.meta?.symbol || asset.meta?.displayName || 'Unknown'} - kind: ${asset.kind} - address: ${asset.contractAddress}`);
    });
    
    // 3. Находим TON и USDT
    const tonAsset = assetList.find(asset => 
      asset.kind === 'Ton' || 
      asset.meta?.symbol === 'TON' ||
      asset.meta?.displayName === 'TON'
    );
    
    const usdtAsset = assetList.find(asset => 
      asset.meta?.symbol === 'USDT' || 
      asset.meta?.symbol === 'jUSDT' ||
      asset.meta?.displayName?.includes('USDT') ||
      asset.contractAddress === 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
    );
    
    console.log("TON asset found:", tonAsset ? `${tonAsset.meta?.symbol || tonAsset.kind}` : 'NOT FOUND');
    console.log("USDT asset found:", usdtAsset ? `${usdtAsset.meta?.symbol}` : 'NOT FOUND');
    
    if (!tonAsset || !usdtAsset) {
      // Попробуем взять первые два доступных актива для тестирования
      const firstAsset = assetList[0];
      const secondAsset = assetList[1];
      
      console.log("Используем первые два доступных актива:");
      console.log("First asset:", firstAsset?.meta?.symbol || firstAsset?.meta?.displayName);
      console.log("Second asset:", secondAsset?.meta?.symbol || secondAsset?.meta?.displayName);
      
      if (!firstAsset || !secondAsset) {
        throw new Error("Недостаточно активов для swap");
      }
      
      // Используем первые два актива
      const fromAsset = firstAsset;
      const toAsset = secondAsset;
      
      logToFile(`Используем активы: ${fromAsset.meta?.symbol} -> ${toAsset.meta?.symbol}`);
      
      // Продолжаем с этими активами
      const fromDecimals = 10 ** (fromAsset.meta?.decimals ?? 9);
      const offerUnits = (Number(offerAmount) * fromDecimals).toString();
      
      // 5. Симулируем swap
      const simulationResult = await client.simulateSwap({
        offerAddress: fromAsset.contractAddress,
        askAddress: toAsset.contractAddress,
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
      
      // 9. Определяем тип swap и получаем параметры
      let txParams;
      
      if (fromAsset.kind === 'Ton') {
        // TON -> Jetton
        txParams = await router.getSwapTonToJettonTxParams({
          userWalletAddress,
          proxyTon: dexContracts.pTON.create(routerMetadata.ptonMasterAddress),
          offerAmount: simulationResult.offerUnits,
          askJettonAddress: simulationResult.askAddress,
          minAskAmount: simulationResult.minAskUnits,
        });
      } else if (toAsset.kind === 'Ton') {
        // Jetton -> TON
        txParams = await router.getSwapJettonToTonTxParams({
          userWalletAddress,
          proxyTon: dexContracts.pTON.create(routerMetadata.ptonMasterAddress),
          offerJettonAddress: simulationResult.offerAddress,
          offerAmount: simulationResult.offerUnits,
          minAskAmount: simulationResult.minAskUnits,
        });
      } else {
        // Jetton -> Jetton
        txParams = await router.getSwapJettonToJettonTxParams({
          userWalletAddress,
          offerJettonAddress: simulationResult.offerAddress,
          askJettonAddress: simulationResult.askAddress,
          offerAmount: simulationResult.offerUnits,
          minAskAmount: simulationResult.minAskUnits,
        });
      }
      
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
          fromAsset: fromAsset.meta?.symbol || fromAsset.meta?.displayName,
          toAsset: toAsset.meta?.symbol || toAsset.meta?.displayName,
          expectedOutput: (Number(simulationResult.minAskUnits) / (10 ** (toAsset.meta?.decimals ?? 9))).toFixed(6)
        }
      };
      
      // === РЕКОМЕНДАЦИЯ: используйте RPC Validator для проверки параметров swap ===
      // Перейдите на https://tokenecosystemrpc.netlify.app/ и вставьте значения ниже для валидации маршрутизации, газа и сборов.
      console.log("=== Для проверки в RPC Validator ===");
      console.log("To:", result.to);
      console.log("Value:", result.value);
      console.log("Body (base64):", result.body);
      console.log("--- Полный результат для интеграции ---");
      console.log(JSON.stringify(result, null, 2));
      return;
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
        fromAsset: tonAsset.meta?.symbol || tonAsset.kind,
        toAsset: usdtAsset.meta?.symbol || usdtAsset.meta?.displayName,
        expectedOutput: (Number(simulationResult.minAskUnits) / (10 ** (usdtAsset.meta?.decimals ?? 6))).toFixed(6)
      }
    };

    // === РЕКОМЕНДАЦИЯ: используйте RPC Validator для проверки параметров swap ===
    // Перейдите на https://tokenecosystemrpc.netlify.app/ и вставьте значения ниже для валидации маршрутизации, газа и сборов.
    console.log("=== Для проверки в RPC Validator ===");
    console.log("To:", result.to);
    console.log("Value:", result.value);
    console.log("Body (base64):", result.body);
    console.log("--- Полный результат для интеграции ---");
    console.log(JSON.stringify(result, null, 2));
    
  } catch (e) {
    logToFile("Ошибка: " + e.toString());
    console.error("Ошибка:", e.message);
    // === РЕКОМЕНДАЦИЯ: при ошибках с ShipFactory/Router используйте RPC Validator ===
    console.error("Если возникли проблемы с маршрутизацией, газом или ShipFactory, проверьте параметры swap через https://tokenecosystemrpc.netlify.app/ для диагностики и получения подсказок.");
    throw e;
  }
}

main().catch(console.error);