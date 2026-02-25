import React, { useState, useEffect, useRef } from 'react';

const IndicatorSearch = ({ onAddIndicator, onClose }) => {
    const [query, setQuery] = useState('');
    const containerRef = useRef();

    const indicators = [
        { id: 'sma', name: 'Simple Moving Average' },
        { id: 'rsi', name: 'Relative Strength Index' },
        { id: 'macd', name: 'Normalized MACD' },
        { id: 'volume_profile', name: 'Volume Profile / HD' },
        { id: 'bb', name: 'Bollinger Bands' },
        { id: 'stoch', name: 'Stochastic Oscillator' },
        { id: 'supertrend', name: 'Super Trend' },
        { id: 'atr', name: 'Average True Range' },
    ];

    const filtered = indicators.filter(ind =>
        ind.name.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div className="indicator-search-overlay" ref={containerRef}>
            <div className="indicator-search-header">
                <input
                    type="text"
                    placeholder="Search indicators..."
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <div className="indicator-search-list">
                {filtered.length > 0 ? filtered.map(ind => (
                    <div
                        key={ind.id}
                        className="indicator-search-item"
                        onClick={() => {
                            onAddIndicator(ind.id);
                            onClose();
                        }}
                    >
                        {ind.name}
                    </div>
                )) : (
                    <div className="indicator-search-no-results">No indicators found</div>
                )}
            </div>
        </div>
    );
};

export default IndicatorSearch;
