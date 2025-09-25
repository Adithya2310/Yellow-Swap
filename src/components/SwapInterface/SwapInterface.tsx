import { useState } from 'preact/hooks';
import styles from './SwapInterface.module.css';

// Hardcoded Polygon ecosystem tokens with working image URLs
const TOKENS = [
    {
        symbol: 'MATIC',
        name: 'Polygon',
        address: '0x0000000000000000000000000000000000001010',
        decimals: 18,
        logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
        balance: '0.5',
        price: 0.22
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
        logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
        balance: '1,234.56',
        price: 1.00
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
        logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
        balance: '856.23',
        price: 0.999
    },
    {
        symbol: 'WETH',
        name: 'Wrapped Ethereum',
        address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        decimals: 18,
        logoUrl: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
        balance: '0.0456',
        price: 2456.78
    },
    {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        decimals: 8,
        logoUrl: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
        balance: '0.0123',
        price: 43567.89
    },
    {
        symbol: 'LINK',
        name: 'Chainlink',
        address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
        decimals: 18,
        logoUrl: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
        balance: '89.34',
        price: 14.23
    }
];

interface SwapInterfaceProps {
    isWalletConnected: boolean;
    isAuthenticated: boolean;
    onSwap?: (fromToken: string, toToken: string, amount: string) => void;
}

export function SwapInterface({ isWalletConnected, isAuthenticated, onSwap }: SwapInterfaceProps) {
    const [fromToken, setFromToken] = useState(TOKENS[0]);
    const [toToken, setToToken] = useState(TOKENS[1]);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [isSwapping, setIsSwapping] = useState(false);

    const calculateToAmount = (amount: string) => {
        if (!amount || isNaN(Number(amount))) return '';
        const fromValue = Number(amount) * fromToken.price;
        const toValue = fromValue / toToken.price;
        return toValue.toFixed(6);
    };

    const handleFromAmountChange = (value: string) => {
        setFromAmount(value);
        setToAmount(calculateToAmount(value));
    };

    const handleTokenSwap = () => {
        const tempToken = fromToken;
        setFromToken(toToken);
        setToToken(tempToken);
        setFromAmount('');
        setToAmount('');
    };

    const handleSwap = async () => {
        if (!onSwap || !fromAmount) return;
        
        setIsSwapping(true);
        try {
            await onSwap(fromToken.symbol, toToken.symbol, fromAmount);
        } catch (error) {
            console.error('Swap failed:', error);
        } finally {
            setIsSwapping(false);
        }
    };

    const isSwapDisabled = !isWalletConnected || !isAuthenticated || !fromAmount || isSwapping;
    const estimatedGas = '<$0.01';
    const priceImpact = '0.01%';

    return (
        <div className={styles.swapContainer}>
            <div className={styles.swapCard}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Swap</h2>
                    <div className={styles.settings}>
                        <button className={styles.settingsButton}>⚙️</button>
                    </div>
                </div>

                {/* From Token */}
                <div className={styles.tokenSection}>
                    <div className={styles.tokenHeader}>
                        <span className={styles.label}>From</span>
                        <span className={styles.balance}>Balance: {fromToken.balance}</span>
                    </div>
                    <div className={styles.tokenInput}>
                        <div className={styles.tokenSelector}>
                            <img src={fromToken.logoUrl} alt={fromToken.symbol} className={styles.tokenLogo} />
                            <span className={styles.tokenSymbol}>{fromToken.symbol}</span>
                            <span className={styles.dropdown}>▼</span>
                        </div>
                        <input
                            type="number"
                            placeholder="0.0"
                            value={fromAmount}
                            onChange={(e) => handleFromAmountChange(e.currentTarget.value)}
                            className={styles.amountInput}
                        />
                    </div>
                    <div className={styles.tokenValue}>
                        ${fromAmount ? (Number(fromAmount) * fromToken.price).toFixed(2) : '0.00'}
                    </div>
                </div>

                {/* Swap Button */}
                <div className={styles.swapButtonContainer}>
                    <button onClick={handleTokenSwap} className={styles.swapTokensButton}>
                        ⇅
                    </button>
                </div>

                {/* To Token */}
                <div className={styles.tokenSection}>
                    <div className={styles.tokenHeader}>
                        <span className={styles.label}>To</span>
                        <span className={styles.balance}>Balance: {toToken.balance}</span>
                    </div>
                    <div className={styles.tokenInput}>
                        <div className={styles.tokenSelector}>
                            <img src={toToken.logoUrl} alt={toToken.symbol} className={styles.tokenLogo} />
                            <span className={styles.tokenSymbol}>{toToken.symbol}</span>
                            <span className={styles.dropdown}>▼</span>
                        </div>
                        <input
                            type="number"
                            placeholder="0.0"
                            value={toAmount}
                            readOnly
                            className={styles.amountInput}
                        />
                    </div>
                    <div className={styles.tokenValue}>
                        ${toAmount ? (Number(toAmount) * toToken.price).toFixed(2) : '0.00'}
                    </div>
                </div>

                {/* Swap Details */}
                {fromAmount && (
                    <div className={styles.swapDetails}>
                        <div className={styles.detailRow}>
                            <span>Price Impact</span>
                            <span className={styles.priceImpact}>{priceImpact}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Network Fee</span>
                            <span>{estimatedGas}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Route</span>
                            <span>{fromToken.symbol} → {toToken.symbol}</span>
                        </div>
                    </div>
                )}

                {/* Main Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={isSwapDisabled}
                    className={`${styles.swapButton} ${isSwapDisabled ? styles.disabled : ''}`}
                >
                    {!isWalletConnected
                        ? 'Connect Wallet'
                        : !isAuthenticated
                        ? 'Authenticating...'
                        : isSwapping
                        ? 'Swapping...'
                        : fromAmount
                        ? `Swap ${fromToken.symbol} for ${toToken.symbol}`
                        : 'Enter Amount'}
                </button>

                {/* Speed Indicator */}
                {isAuthenticated && (
                    <div className={styles.speedIndicator}>
                        <div className={styles.speedBadge}>
                            ⚡ Lightning Fast • ~0.1s execution
                        </div>
                    </div>
                )}
            </div>

            {/* Market Stats */}
            <div className={styles.marketStats}>
                <h3 className={styles.statsTitle}>Market Overview</h3>
                <div className={styles.statsGrid}>
                    {TOKENS.slice(0, 4).map((token) => (
                        <div key={token.symbol} className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <img src={token.logoUrl} alt={token.symbol} className={styles.statLogo} />
                                <span className={styles.statSymbol}>{token.symbol}</span>
                            </div>
                            <div className={styles.statPrice}>${token.price.toLocaleString()}</div>
                            <div className={styles.statChange}>+2.45%</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
