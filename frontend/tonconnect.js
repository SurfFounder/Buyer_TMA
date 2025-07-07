// Подключение TON Connect UI
const btn = document.getElementById('ton-connect-btn');
const walletDiv = document.getElementById('wallet-address');

btn.onclick = async () => {
    if (window.TonConnect) {
        // Уже инициализировано
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
    script.onload = () => {
        const tonConnectUI = new TonConnectUI.TonConnectUI({
            manifestUrl: 'https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json',
        });
        tonConnectUI.uiOptions = { language: 'ru' };
        tonConnectUI.onStatusChange(wallet => {
            if (wallet && wallet.account) {
                walletDiv.innerText = 'Адрес: ' + wallet.account.address;
            } else {
                walletDiv.innerText = '';
            }
        });
        tonConnectUI.openModal();
    };
    document.body.appendChild(script);
}; 