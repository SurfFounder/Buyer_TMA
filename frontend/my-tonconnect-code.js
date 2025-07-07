const btn = document.getElementById('ton-connect-btn');
const walletDiv = document.getElementById('wallet-address');

let tonConnectUI;

async function getUSDTBalance(address) {
    const response = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons`);
    if (!response.ok) return "Ошибка API";
    const data = await response.json();
    if (!data.balances) return "Нет данных";
    const usdtJettonAddress = "EQCkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
    const usdt = data.balances.find(j => j.jetton.address === usdtJettonAddress);
    if (usdt) {
        return (parseInt(usdt.balance) / 1e9).toLocaleString('en-US', {maximumFractionDigits: 2});
    }
    return "0";
}

btn.onclick = () => {
    if (!tonConnectUI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://buyer-tma.vercel.app/tonconnect-manifest.json',
        });
        tonConnectUI.uiOptions = { language: 'ru' };
        tonConnectUI.onStatusChange(async wallet => {
            if (wallet && wallet.account) {
                // Используем адрес напрямую, если он уже user-friendly (обычно так и есть)
                const address = wallet.account.address;
                walletDiv.innerText = 'Адрес: ' + address + '\nЗагрузка баланса...';
                const balance = await getUSDTBalance(address);
                walletDiv.innerText = `Адрес: ${address}\nUSDT: ${balance}`;
            } else {
                walletDiv.innerText = '';
            }
        });
    }
    tonConnectUI.openModal();
}; 