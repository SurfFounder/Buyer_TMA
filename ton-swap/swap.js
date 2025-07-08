import { TonClient, WalletContractV4, internal, toNano, Address } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import { dexFactory, Client } from "@ston-fi/sdk";
import { StonApiClient, AssetTag } from '@ston-fi/api';
import fs from "fs";

const userWalletAddress = process.argv[2];
const offerAmount = process.argv[3];

// Используем mainnet endpoint вместо testnet
const tonApiClient = new Client({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
});

// Адрес вашего DCA_Pool контракта
const DCA_POOL_ADDRESS = "<ВАШ_АДРЕС_КОНТРАКТА>"; // замените на ваш адрес

async function callSwapUSDTtoTON(userAddress, amountUSDT, minTON, mnemonic) {
  const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });
  const key = await mnemonicToWalletKey(mnemonic.split(" "));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  const seqno = await client.getSeqno(wallet.address);

  // Формируем payload для swapUSDTtoTON (user, amount, minTON)
  // Здесь нужно сериализовать параметры в Cell/BOC для Tact
  // Пример (упрощённо):
  const payload = Buffer.concat([
    Buffer.from("swapUSDTtoTON"),
    Buffer.from(Address.parse(userAddress).toRawBuffer()),
    Buffer.from(amountUSDT.toString(16).padStart(16, '0'), 'hex'),
    Buffer.from(minTON.toString(16).padStart(16, '0'), 'hex'),
  ]);

  const transfer = internal({
    to: Address.parse(DCA_POOL_ADDRESS),
    value: toNano("0.1"), // комиссия
    body: payload,
  });

  await client.sendExternalMessage(wallet, transfer, key.secretKey);
}

function logToFile(message) {
  fs.appendFileSync("swap.log", `[${new Date().toISOString()}] ${message}\n`);
}

async function main() {
  // Удаляем лишний вывод
  // logToFile оставляем для внутреннего логирования, но не выводим в stdout
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
    
    if (!tonAsset || !usdtAsset) {
      // Попробуем взять первые два доступных актива для тестирования
      const firstAsset = assetList[0];
      const secondAsset = assetList[1];
      
      if (!firstAsset || !secondAsset) {
        throw new Error("Недостаточно активов для swap");
      }
      
      // Используем первые два актива
      const fromAsset = firstAsset;
      const toAsset = secondAsset;
      
      logToFile(`Используем активы: ${fromAsset.meta?.symbol} -> ${toAsset.meta?.symbol}`);
      
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
      console.log(JSON.stringify(result));
      return;
    }
    
    // 4. Конвертируем amount в правильные единицы (USDT)
    const usdtDecimals = 10 ** (usdtAsset.meta?.decimals ?? 6);
    const offerUnits = (Number(offerAmount) * usdtDecimals).toString();
    
    // 5. Симулируем swap USDT -> TON
    const simulationResult = await client.simulateSwap({
      offerAddress: usdtAsset.contractAddress, // USDT
      askAddress: tonAsset.contractAddress,    // TON
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
    
    // 9. Получаем параметры транзакции для swap Jetton -> TON
    const txParams = await router.getSwapJettonToTonTxParams({
      userWalletAddress,
      proxyTon: dexContracts.pTON.create(routerMetadata.ptonMasterAddress),
      offerJettonAddress: simulationResult.offerAddress,
      offerAmount: simulationResult.offerUnits,
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
        fromAsset: usdtAsset.meta?.symbol || usdtAsset.meta?.displayName,
        toAsset: tonAsset.meta?.symbol || tonAsset.kind,
        expectedOutput: (Number(simulationResult.minAskUnits) / (10 ** (tonAsset.meta?.decimals ?? 9))).toFixed(6)
      }
    };
    console.log(JSON.stringify(result));
    return;
    
  } catch (e) {
    logToFile("Ошибка: " + e.toString());
    // Не выводим ничего в stdout/console.error
    throw e;
  }
}

main().catch(console.error);