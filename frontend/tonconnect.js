// Подключение TON Connect UI
const btn = document.getElementById('ton-connect-btn');
const walletDiv = document.getElementById('wallet-address');

let tonConnectUI;

btn.onclick = () => {
    if (!tonConnectUI) {
        tonConnectUI = new TonConnectUI.TonConnectUI({
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
    }
    tonConnectUI.openModal();
}; 