#!/usr/bin/env node

// Simple Cerebro alternative using Node.js WebSocket
const WebSocket = require('ws');
const readline = require('readline');

if (process.argv.length < 3) {
    console.log('Usage: node simple-cerebro.js <clearnode_ws_url>');
    process.exit(1);
}

const wsUrl = process.argv[2];
console.log(`Connecting to: ${wsUrl}`);

const ws = new WebSocket(wsUrl);
let requestId = 1;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>>> '
});

ws.on('open', function open() {
    console.log('✅ Connected to Clearnode');
    console.log('Available commands:');
    console.log('  - auth <address> <signature>');
    console.log('  - balance <address>');
    console.log('  - transfer <to> <amount> <asset>');
    console.log('  - exit');
    rl.prompt();
});

ws.on('message', function message(data) {
    try {
        const response = JSON.parse(data);
        console.log('📨 Response:', JSON.stringify(response, null, 2));
    } catch (e) {
        console.log('📨 Raw response:', data.toString());
    }
    rl.prompt();
});

ws.on('close', function close() {
    console.log('❌ Disconnected from Clearnode');
    process.exit(0);
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err.message);
    process.exit(1);
});

rl.on('line', (input) => {
    const command = input.trim();
    
    if (command === 'exit') {
        ws.close();
        return;
    }
    
    if (command === '') {
        rl.prompt();
        return;
    }
    
    const parts = command.split(' ');
    const cmd = parts[0];
    
    let message;
    
    switch (cmd) {
        case 'auth':
            if (parts.length < 3) {
                console.log('Usage: auth <address> <signature>');
                break;
            }
            message = {
                jsonrpc: '2.0',
                id: requestId++,
                method: 'auth_request',
                params: {
                    address: parts[1],
                    signature: parts[2]
                }
            };
            break;
            
        case 'balance':
            if (parts.length < 2) {
                console.log('Usage: balance <address>');
                break;
            }
            message = {
                jsonrpc: '2.0',
                id: requestId++,
                method: 'get_ledger_balances',
                params: {
                    address: parts[1]
                }
            };
            break;
            
        case 'transfer':
            if (parts.length < 4) {
                console.log('Usage: transfer <to> <amount> <asset>');
                break;
            }
            message = {
                jsonrpc: '2.0',
                id: requestId++,
                method: 'transfer',
                params: {
                    destination: parts[1],
                    allocations: [{
                        asset: parts[3],
                        amount: parts[2]
                    }]
                }
            };
            break;
            
        default:
            // Send raw JSON-RPC if it looks like one
            try {
                message = JSON.parse(command);
            } catch (e) {
                console.log('❌ Unknown command or invalid JSON:', command);
                console.log('Available commands: auth, balance, transfer, exit');
            }
    }
    
    if (message) {
        console.log('📤 Sending:', JSON.stringify(message, null, 2));
        ws.send(JSON.stringify(message));
    }
    
    rl.prompt();
});

rl.on('close', () => {
    console.log('\nGoodbye!');
    ws.close();
});
