window.addEventListener('DOMContentLoaded', function() {
const btn = document.getElementById('ton-connect-btn');
const walletDiv = document.getElementById('wallet-address');
const sendTxBtn = document.getElementById('send-transaction-btn');
const usdtAmountInput = document.getElementById('usdt-amount');

let tonConnectUI;

async function getUSDTBalance(address) {
    const response = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons`);
    if (!response.ok) return "Ошибка API";
    const data = await response.json();
    console.log('TONAPI RESPONSE:', data);
    if (!data.balances) return "Нет данных";
    const usdtJettonAddress = "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe";
    const usdt = data.balances.find(j => j.jetton.address === usdtJettonAddress);
    if (usdt) {
        return (parseInt(usdt.balance) / Math.pow(10, usdt.jetton.decimals)).toLocaleString('en-US', {maximumFractionDigits: 2});
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
                const rawAddress = wallet.account.address; // raw (0:...)
                const userFriendly = toUserFriendly(rawAddress);
                walletDiv.innerText = 'Адрес: ' + userFriendly + '\nЗагрузка баланса...';
                const balance = await getUSDTBalance(rawAddress); // используем raw-адрес для API
                walletDiv.innerText = `Адрес: ${userFriendly}\nUSDT: ${balance}`;
                sendTxBtn.style.display = '';
                usdtAmountInput.style.display = '';
            } else {
                walletDiv.innerText = '';
                sendTxBtn.style.display = 'none';
                usdtAmountInput.style.display = 'none';
            }
        });
    }
    tonConnectUI.openModal();
};

sendTxBtn.onclick = async () => {
    const amount = usdtAmountInput.value;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        alert("Введите сумму USDT для обмена");
        return;
    }
    if (!tonConnectUI || !tonConnectUI.account || !tonConnectUI.account.address) {
        alert("Сначала подключите TON кошелек");
        return;
    }
    sendTxBtn.disabled = true;
    sendTxBtn.innerText = 'Обработка...';
    try {
        const rawAddress = tonConnectUI.account.address;
        // Получаем параметры swap с backend
        const resp = await fetch("http://localhost:8000/swap/jetton-to-ton", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_address: rawAddress,
                amount: amount
            })
        });
        const txParams = await resp.json();
        if (txParams.error) {
            alert("Ошибка: " + txParams.error);
            return;
        }
        // Отправляем транзакцию через TonConnect
        tonConnectUI.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 60,
            messages: [
                {
                    address: txParams.to,
                    amount: txParams.value,
                    payload: txParams.body,
                }
            ]
        });
    } catch (e) {
        alert("Ошибка при обмене: " + e.message);
    } finally {
        sendTxBtn.disabled = false;
        sendTxBtn.innerText = 'Отправить USDT';
    }
};
}); 