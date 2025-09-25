import { useState, useEffect } from 'preact/hooks';
import { createWalletClient, custom, type Address, type WalletClient } from 'viem';
import { polygonAmoy } from 'viem/chains';
// CHAPTER 3: Authentication imports
// CHAPTER 4: Add balance fetching imports
import {
    createAuthRequestMessage,
    createAuthVerifyMessage,
    createEIP712AuthMessageSigner,
    parseAnyRPCResponse,
    RPCMethod,
    type AuthChallengeResponse,
    type AuthRequestParams,
    createECDSAMessageSigner,
    createGetLedgerBalancesMessage,
    type GetLedgerBalancesResponse,
    type BalanceUpdateResponse,
    type TransferResponse,
} from '@erc7824/nitrolite';
// YellowSwap: Import SwapInterface component
import { SwapInterface } from './components/SwapInterface/SwapInterface';
// Keep BalanceDisplay for showing user balance
import { BalanceDisplay } from './components/BalanceDisplay/BalanceDisplay';
// Keep useTransfer hook for swap functionality
import { useTransfer } from './hooks/useTransfer';

// Comment out old post-related imports
// import { PostList } from './components/PostList/PostList';
// import { posts } from './data/posts';
import { webSocketService, type WsStatus } from './lib/websocket';
// CHAPTER 3: Authentication utilities
import {
    generateSessionKey,
    getStoredSessionKey,
    storeSessionKey,
    removeSessionKey,
    storeJWT,
    removeJWT,
    type SessionKey,
} from './lib/utils';

declare global {
    interface Window {
        ethereum?: any;
    }
}

// YellowSwap: EIP-712 domain for authentication
const getAuthDomain = () => ({
    name: 'YellowSwap',
});

// YellowSwap: Authentication constants
const AUTH_SCOPE = 'yellowswap.com';
const APP_NAME = 'YellowSwap';
const SESSION_DURATION = 3600; // 1 hour

export function App() {
    const [account, setAccount] = useState<Address | null>(null);
    const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
    const [wsStatus, setWsStatus] = useState<WsStatus>('Disconnected');
    // CHAPTER 3: Authentication state
    const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthAttempted, setIsAuthAttempted] = useState(false);
    const [sessionExpireTimestamp, setSessionExpireTimestamp] = useState<string>('');
    // CHAPTER 4: Add balance state to store fetched balances
    const [balances, setBalances] = useState<Record<string, string> | null>(null);
    // CHAPTER 4: Add loading state for better user experience
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    
    // FINAL: Add transfer state
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferStatus, setTransferStatus] = useState<string | null>(null);
    
    // Keep useTransfer hook for future swap functionality
    // const { handleTransfer: transferFn } = useTransfer(sessionKey, isAuthenticated);

    useEffect(() => {
        // CHAPTER 3: Get or generate session key on startup (IMPORTANT: Store in localStorage)
        const existingSessionKey = getStoredSessionKey();
        if (existingSessionKey) {
            setSessionKey(existingSessionKey);
        } else {
            const newSessionKey = generateSessionKey();
            storeSessionKey(newSessionKey);
            setSessionKey(newSessionKey);
        }

        webSocketService.addStatusListener(setWsStatus);
        webSocketService.connect();

        return () => {
            webSocketService.removeStatusListener(setWsStatus);
        };
    }, []);

    // YellowSwap: Auto-trigger authentication when conditions are met
    useEffect(() => {
        if (account && sessionKey && wsStatus === 'Connected' && !isAuthenticated && !isAuthAttempted) {
            console.log('Starting authentication process...');
            setIsAuthAttempted(true);

            // Generate fresh timestamp for this auth attempt
            const expireTimestamp = String(Math.floor(Date.now() / 1000) + SESSION_DURATION);
            setSessionExpireTimestamp(expireTimestamp);

            const authParams: AuthRequestParams = {
                address: account,
                session_key: sessionKey.address,
                app_name: APP_NAME,
                expire: expireTimestamp,
                scope: AUTH_SCOPE,
                application: account,
                allowances: [],
            };

            createAuthRequestMessage(authParams).then((payload) => {
                console.log('Sending auth request:', payload);
                webSocketService.send(payload);
            }).catch((error) => {
                console.error('Failed to create auth request:', error);
                setIsAuthAttempted(false);
            });
        }
    }, [account, sessionKey, wsStatus, isAuthenticated, isAuthAttempted]);

    // CHAPTER 4: Automatically fetch balances when user is authenticated
    // This useEffect hook runs whenever authentication status, sessionKey, or account changes
    useEffect(() => {
        // Only proceed if all required conditions are met:
        // 1. User has completed authentication
        // 2. We have a session key (temporary private key for signing)
        // 3. We have the user's wallet address
        if (isAuthenticated && sessionKey && account) {
            console.log('Authenticated! Fetching ledger balances...');

            // CHAPTER 4: Show loading state while we fetch balances
            setIsLoadingBalances(true);

            // CHAPTER 4: Create a "signer" - this is what signs our requests without user popups
            // Think of this like a temporary stamp that proves we're allowed to make requests
            const sessionSigner = createECDSAMessageSigner(sessionKey.privateKey);

            // CHAPTER 4: Create a signed request to get the user's asset balances
            // This is like asking "What's in my wallet?" but with cryptographic proof
            createGetLedgerBalancesMessage(sessionSigner, account)
                .then((getBalancesPayload) => {
                    // Send the signed request through our WebSocket connection
                    console.log('Sending balance request...');
                    webSocketService.send(getBalancesPayload);
                })
                .catch((error) => {
                    console.error('Failed to create balance request:', error);
                    setIsLoadingBalances(false); // Stop loading on error
                    // In a real app, you might show a user-friendly error message here
                });
        }
    }, [isAuthenticated, sessionKey, account]);

    // YellowSwap: Handle swap function
    const handleSwap = async (fromToken: string, toToken: string, amount: string) => {
        setIsTransferring(true);
        setTransferStatus(`Swapping ${amount} ${fromToken} for ${toToken}...`);
        
        // For now, we'll simulate a swap using the transfer function
        // In a real implementation, this would call a swap-specific function
        console.log(`Swapping ${amount} ${fromToken} for ${toToken}`);
        
        // Simulate swap completion
        setTimeout(() => {
            setIsTransferring(false);
            setTransferStatus(null);
            alert(`Successfully swapped ${amount} ${fromToken} for ${toToken}!`);
        }, 2000);
    };

    // CHAPTER 3: Handle server messages for authentication
    useEffect(() => {
        const handleMessage = async (data: any) => {
            const response = parseAnyRPCResponse(JSON.stringify(data));

            // Handle auth challenge
            if (
                response.method === RPCMethod.AuthChallenge &&
                walletClient &&
                sessionKey &&
                account &&
                sessionExpireTimestamp
            ) {
                const challengeResponse = response as AuthChallengeResponse;

                const authParams = {
                    scope: AUTH_SCOPE,
                    application: walletClient.account?.address as `0x${string}`,
                    participant: sessionKey.address as `0x${string}`,
                    expire: sessionExpireTimestamp,
                    allowances: [],
                };

                const eip712Signer = createEIP712AuthMessageSigner(walletClient, authParams, getAuthDomain());

                try {
                    const authVerifyPayload = await createAuthVerifyMessage(eip712Signer, challengeResponse);
                    webSocketService.send(authVerifyPayload);
                } catch (error) {
                    alert('Signature rejected. Please try again.');
                    setIsAuthAttempted(false);
                }
            }

            // Handle auth success
            if (response.method === RPCMethod.AuthVerify && response.params?.success) {
                setIsAuthenticated(true);
                if (response.params.jwtToken) storeJWT(response.params.jwtToken);
            }

            // CHAPTER 4: Handle balance responses (when we asked for balances)
            if (response.method === RPCMethod.GetLedgerBalances) {
                const balanceResponse = response as GetLedgerBalancesResponse;
                const balances = balanceResponse.params.ledgerBalances;

                console.log('Received balance response:', balances);

                // Check if we actually got balance data back
                if (balances && balances.length > 0) {
                    // CHAPTER 4: Transform the data for easier use in our UI
                    // Convert from: [{asset: "usdc", amount: "100"}, {asset: "eth", amount: "0.5"}]
                    // To: {"usdc": "100", "eth": "0.5"}
                    const balancesMap = Object.fromEntries(
                        balances.map((balance) => [balance.asset, balance.amount]),
                    );
                    console.log('Setting balances:', balancesMap);
                    setBalances(balancesMap);
                } else {
                    console.log('No balance data received - wallet appears empty');
                    setBalances({});
                }
                // CHAPTER 4: Stop loading once we receive any balance response
                setIsLoadingBalances(false);
            }

            // CHAPTER 4: Handle live balance updates (server pushes these automatically)
            if (response.method === RPCMethod.BalanceUpdate) {
                const balanceUpdate = response as BalanceUpdateResponse;
                const balances = balanceUpdate.params.balanceUpdates;

                console.log('Live balance update received:', balances);

                // Same data transformation as above
                const balancesMap = Object.fromEntries(
                    balances.map((balance) => [balance.asset, balance.amount]),
                );
                console.log('Updating balances in real-time:', balancesMap);
                setBalances(balancesMap);
            }

            // FINAL: Handle transfer response
            if (response.method === RPCMethod.Transfer) {
                const transferResponse = response as TransferResponse;
                console.log('Transfer completed:', transferResponse.params);
                
                setIsTransferring(false);
                setTransferStatus(null);
                
                alert(`Transfer completed successfully!`);
            }

            // Handle errors
            if (response.method === RPCMethod.Error) {
                console.error('RPC Error:', response.params);
                
                if (isTransferring) {
                    setIsTransferring(false);
                    setTransferStatus(null);
                    alert(`Transfer failed: ${response.params.error}`);
                } else {
                    // Other errors (like auth failures)
                    console.log('Authentication error, resetting...');
                    removeJWT();
                    // Don't remove session key immediately, just reset auth attempt
                    setIsAuthAttempted(false);
                    setIsAuthenticated(false);
                    // Retry authentication after a delay
                    setTimeout(() => {
                        if (account && sessionKey && wsStatus === 'Connected') {
                            setIsAuthAttempted(false);
                        }
                    }, 3000);
                }
            }
        };

        webSocketService.addMessageListener(handleMessage);
        return () => webSocketService.removeMessageListener(handleMessage);
    }, [walletClient, sessionKey, sessionExpireTimestamp, account, isTransferring]);

    const connectWallet = async () => {
        if (!window.ethereum) {
            alert('MetaMask not found! Please install MetaMask from https://metamask.io/');
            return;
        }

        try {
            // Check current network - Polygon Amoy testnet
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId !== '0x13882') { // Polygon Amoy testnet (chain ID 80002 = 0x13882)
                alert('Please switch to Polygon Amoy testnet in MetaMask for this workshop');
                // Note: In production, you might want to automatically switch networks
            }

            const tempClient = createWalletClient({
                chain: polygonAmoy,
                transport: custom(window.ethereum),
            });
            const [address] = await tempClient.requestAddresses();

            if (!address) {
                alert('No wallet address found. Please ensure MetaMask is unlocked.');
                return;
            }

            // YellowSwap: Create wallet client with account for EIP-712 signing
            const walletClient = createWalletClient({
                account: address,
                chain: polygonAmoy,
                transport: custom(window.ethereum),
            });

            setWalletClient(walletClient);
            setAccount(address);
        } catch (error) {
            console.error('Wallet connection failed:', error);
            alert('Failed to connect wallet. Please try again.');
            return;
        }
    };

    const disconnectWallet = () => {
        // Clear all wallet-related state
        setWalletClient(null);
        setAccount(null);
        setSessionKey(null);
        setIsAuthenticated(false);
        setIsAuthAttempted(false);
        setBalances(null);
        setIsLoadingBalances(false);
        setTransferStatus(null);
        setIsTransferring(false);
        
        // Clear stored session data
        removeSessionKey();
        removeJWT();
        
        console.log('Wallet disconnected successfully');
    };

    const formatAddress = (address: Address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-content">
                    <h1 className="logo">YellowSwap</h1>
                    <p className="tagline">Lightning-Fast Cross-Chain Token Swaps</p>
                </div>
                <div className="header-controls">
                    {/* Display balance when authenticated */}
                    {/* {isAuthenticated && (
                        <BalanceDisplay
                            balance={
                                isLoadingBalances ? 'Loading...' : (balances?.['matic'] ?? null)
                            }
                            symbol="MATIC"
                        />
                    )} */}
                    {/* <div className={`ws-status ${wsStatus.toLowerCase()}`}>
                        <span className="status-dot"></span> {wsStatus}
                    </div> */}
                    <div className="wallet-connector">
                        {account ? (
                            <button onClick={disconnectWallet} className="disconnect-button">
                                Disconnect Wallet
                            </button>
                        ) : (
                            <button onClick={connectWallet} className="connect-button">
                                Connect Wallet
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="main-content">
                {/* Status message for swaps */}
                {transferStatus && (
                    <div className="transfer-status">
                        {transferStatus}
                    </div>
                )}
                
                {/* YellowSwap Interface */}
                <SwapInterface 
                    isWalletConnected={!!account} 
                    isAuthenticated={isAuthenticated}
                    onSwap={handleSwap}
                />

                {/* Comment out old PostList component */}
                {/* 
                <PostList 
                    posts={posts} 
                    isWalletConnected={!!account} 
                    isAuthenticated={isAuthenticated}
                    onTransfer={handleSupport}
                    isTransferring={isTransferring}
                />
                */}
            </main>
        </div>
    );
}
