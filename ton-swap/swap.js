import { TonClient, toNano } from "@ton/ton";
import { DEX, pTON } from "@ston-fi/sdk";

const userWalletAddress = process.argv[2];
const offerAmount = process.argv[3];

const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

const router = client.open(
  DEX.v2_1.Router.CPI.create(
    "kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v" // CPI Router v2.1.0
  )
);

const proxyTon = pTON.v2_1.create(
  "kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px" // pTON v2.1.0
);

async function main() {
  const txParams = await router.getSwapTonToJettonTxParams({
    userWalletAddress,
    proxyTon,
    offerAmount: toNano(offerAmount),
    askJettonAddress: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    minAskAmount: "1",
    referralAddress: "",
    referralValue: 0,
    queryId: 12345,
  });
  // Выводим параметры в формате JSON для backend
  console.log(JSON.stringify(txParams));
}

main(); 