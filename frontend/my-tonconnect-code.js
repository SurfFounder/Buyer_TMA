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

// Функция для конвертации TON-адреса из hex (0:...) в user-friendly (base64url, 36 байт)
function hexToUserFriendly(address) {
    address = address.replace(/^0x/, '');
    const [wc, hex] = address.split(":");
    const wcNum = parseInt(wc, 10);
    const hexStr = hex.length === 64 ? hex : hex.padStart(64, '0');
    const bytes = new Uint8Array(36);
    // Tag: 0x11 (bounceable, non-testnet, no anycast)
    bytes[0] = 0x11;
    // Workchain
    bytes[1] = wcNum < 0 ? 0xff : wcNum;
    // Address
    for (let i = 0; i < 32; i++) {
        bytes[i + 2] = parseInt(hexStr.substr(i * 2, 2), 16);
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
    const crc = crc16(bytes.slice(0, 34));
    bytes[34] = crc >> 8;
    bytes[35] = crc & 0xff;
    // base64url
    let b64 = btoa(String.fromCharCode.apply(null, bytes));
    b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
}

btn.onclick = () => {
    if (!tonConnectUI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://buyer-tma.vercel.app/tonconnect-manifest.json',
        });
        tonConnectUI.uiOptions = { language: 'ru' };
        tonConnectUI.onStatusChange(async wallet => {
            if (wallet && wallet.account) {
                // Преобразуем адрес в user-friendly base64url
                const userFriendlyAddress = hexToUserFriendly(wallet.account.address);
                walletDiv.innerText = 'Адрес: ' + userFriendlyAddress + '\nЗагрузка баланса...';
                const balance = await getUSDTBalance(userFriendlyAddress);
                walletDiv.innerText = `Адрес: ${userFriendlyAddress}\nUSDT: ${balance}`;
            } else {
                walletDiv.innerText = '';
            }
        });
    }
    tonConnectUI.openModal();
}; 