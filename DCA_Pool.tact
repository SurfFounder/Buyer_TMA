// DCA пул для USDT->TON
contract DCA_Pool {
    // Адрес Jetton (USDT)
    address usdt_jetton_address;
    // Адрес STON.fi Router
    address stonfi_router_address;

    // Балансы пользователей
    map<address, (usdt: uint128, ton: uint128)> balances;

    // Депозит USDT (Jetton transfer)
    receive("JettonTransfer") {
        // Проверяем, что jetton правильный
        require(msg.sender == usdt_jetton_address, 101);
        // Получаем адрес отправителя
        address user = msg.body.query_address("from");
        uint128 amount = msg.body.query_uint128("amount");
        // Обновляем баланс
        var bal = balances.get(user).unwrap_or((0, 0));
        balances.set(user, (bal.0 + amount, bal.1));
    }

    // Вывод USDT
    external fun withdrawUSDT(amount: uint128) {
        require(amount > 0, 102);
        var bal = balances.get(msg.sender).unwrap_or((0, 0));
        require(bal.0 >= amount, 103);
        // Обновляем баланс
        balances.set(msg.sender, (bal.0 - amount, bal.1));
        // Отправляем jetton пользователю
        send_jetton(usdt_jetton_address, msg.sender, amount);
    }

    // Вывод TON
    external fun withdrawTON(amount: uint128) {
        require(amount > 0, 104);
        var bal = balances.get(msg.sender).unwrap_or((0, 0));
        require(bal.1 >= amount, 105);
        // Обновляем баланс
        balances.set(msg.sender, (bal.0, bal.1 - amount));
        // Отправляем TON пользователю
        send_raw(msg.sender, amount);
    }

    // Обмен USDT на TON (вызывает off-chain скрипт)
    external fun swapUSDTtoTON(user: address, amount: uint128, min_ton: uint128) {
        // Проверяем баланс пользователя
        var bal = balances.get(user).unwrap_or((0, 0));
        require(bal.0 >= amount, 106);
        // Обновляем баланс (замораживаем USDT)
        balances.set(user, (bal.0 - amount, bal.1));
        // Вызываем STON.fi Router для обмена
        call_stonfi_swap(user, amount, min_ton);
        // После обмена Router отправит TON на этот контракт
        // В onBounce/onSuccess увеличить balances[user].ton
    }

    // Обработка получения TON после обмена
    receive("Internal") {
        // Проверяем, что отправитель — Router
        require(msg.sender == stonfi_router_address, 107);
        // Получаем адрес пользователя и сумму
        address user = msg.body.query_address("user");
        uint128 ton_amount = msg.value;
        // Обновляем баланс
        var bal = balances.get(user).unwrap_or((0, 0));
        balances.set(user, (bal.0, bal.1 + ton_amount));
    }
} 