import React from 'react';

const TopBar = ({
    symbol, setSymbol,
    interval, setInterval,
    chartType, setChartType,
    openIndicatorSearch,
    openSymbolSearch
}) => {
    const intervals = [
        { label: '1m', value: '1m' },
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '1h', value: '1h' },
        { label: '4h', value: '4h' },
        { label: '1D', value: '1d' },
        { label: '1W', value: '1wk' },
        { label: '1M', value: '1mo' },
    ];

    const chartTypes = [
        { label: 'Candles', value: 'candle' },
        { label: 'Line', value: 'line' },
        { label: 'Heikin Ashi', value: 'heikin' },
    ];

    return (
        <div className="top-bar">
            <div className="top-bar-brand">
                Open Trader
            </div>

            <div className="top-bar-divider" />

            <div className="top-bar-section search-section">
                <button
                    className="symbol-search-btn"
                    onClick={openSymbolSearch}
                >
                    <span className="search-icon">🔍</span>
                    <span className="current-symbol">{symbol}</span>
                </button>
            </div>

            <div className="top-bar-divider" />

            <div className="top-bar-section interval-section">
                <div className="button-group">
                    {intervals.map(int => (
                        <button
                            key={int.value}
                            className={`toolbar-btn ${interval === int.value ? 'active' : ''}`}
                            onClick={() => setInterval(int.value)}
                        >
                            {int.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="top-bar-divider" />

            <div className="top-bar-section type-section">
                <div className="button-group">
                    {chartTypes.map(type => (
                        <button
                            key={type.value}
                            className={`toolbar-btn ${chartType === type.value ? 'active' : ''}`}
                            onClick={() => setChartType(type.value)}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="top-bar-divider" />

            <div className="top-bar-section indicators-section">
                <button
                    className="toolbar-btn primary"
                    onClick={openIndicatorSearch}
                >
                    <span style={{ fontSize: '16px', marginRight: '4px' }}>📊</span>
                    Indicators
                </button>
            </div>
        </div>
    );
};

export default TopBar;
