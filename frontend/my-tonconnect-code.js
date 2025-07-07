const btn = document.getElementById('ton-connect-btn');
const walletDiv = document.getElementById('wallet-address');

let tonConnectUI;

async function getUSDTBalance(address) {
    const response = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons`);
    const data = await response.json();
    const usdtJettonAddress = "EQCkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
    const usdt = data.balances.find(j => j.jetton.address === usdtJettonAddress);
    if (usdt) {
        return (parseInt(usdt.balance) / 1e9).toLocaleString('en-US', {maximumFractionDigits: 2});
    }
    return "0";
}

// Функция для конвертации TON-адреса из hex (0:...) в base64 (user-friendly)
function hexToBase64(address) {
    // Удаляем 0x если есть
    address = address.replace(/^0x/, '');
    // Разделяем workchain и адрес
    const [wc, hex] = address.split(":");
    const wcNum = parseInt(wc, 10);
    const hexStr = hex.length === 64 ? hex : hex.padStart(64, '0');
    // Собираем байты
    const bytes = new Uint8Array(34);
    bytes[0] = wcNum < 0 ? 0xff : wcNum;
    for (let i = 0; i < 32; i++) {
        bytes[i + 1] = parseInt(hexStr.substr(i * 2, 2), 16);
    }
    // CRC16
    function crc16(data) {
        let crc = 0xffff;
        for (let b of data) {
            crc ^= b << 8;
            for (let i = 0; i < 8; i++) {
                if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
                else crc <<= 1;
            }
            crc &= 0xffff;
        }
        return crc;
    }
    const crc = crc16(bytes.slice(0, 33));
    bytes[33] = crc >> 8;
    bytes[34] = crc & 0xff;
    // base64
    return btoa(String.fromCharCode.apply(null, bytes));
}

btn.onclick = () => {
    if (!tonConnectUI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://buyer-tma.vercel.app/tonconnect-manifest.json',
        });
        tonConnectUI.uiOptions = { language: 'ru' };
        tonConnectUI.onStatusChange(async wallet => {
            if (wallet && wallet.account) {
                // Преобразуем адрес в base64
                const base64Address = hexToBase64(wallet.account.address);
                walletDiv.innerText = 'Адрес: ' + base64Address + '\nЗагрузка баланса...';
                const balance = await getUSDTBalance(base64Address);
                walletDiv.innerText = `Адрес: ${base64Address}\nUSDT: ${balance}`;
            } else {
                walletDiv.innerText = '';
            }
        });
    }
    tonConnectUI.openModal();
}; 