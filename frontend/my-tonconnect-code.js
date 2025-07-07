window.addEventListener('DOMContentLoaded', function() {
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

// Функция для конвертации raw TON-адреса в user-friendly с помощью tonweb
function toUserFriendly(address) {
    // address: '0:...' (raw)
    try {
        // new TonWeb.Address(...).toString(true, true, false) => non-bounceable, user-friendly, url-safe
        return new TonWeb.Address(address).toString(true, true, false);
    } catch (e) {
        return address;
    }
}

btn.onclick = () => {
    if (!tonConnectUI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://buyer-tma.vercel.app/tonconnect-manifest.json',
        });
        tonConnectUI.uiOptions = { language: 'ru' };
        tonConnectUI.onStatusChange(async wallet => {
            if (wallet && wallet.account) {
                // Преобразуем raw-адрес в user-friendly для отображения
                const address = wallet.account.address;
                const userFriendly = toUserFriendly(address);
                walletDiv.innerText = 'Адрес: ' + userFriendly + '\nЗагрузка баланса...';
                const balance = await getUSDTBalance(userFriendly);
                walletDiv.innerText = `Адрес: ${userFriendly}\nUSDT: ${balance}`;
            } else {
                walletDiv.innerText = '';
            }
        });
    }
    tonConnectUI.openModal();
};
}); 