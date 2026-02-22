import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SymbolSearch = ({ onSelectSymbol, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef();
    const inputRef = useRef();

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.trim().length === 0) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const response = await axios.get(`/api/search/?q=${query}`);
                setResults(response.data);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="indicator-search-overlay symbol-search-overlay" ref={containerRef}>
            <div className="indicator-search-header">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search stocks, crypto..."
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <div className="indicator-search-list">
                {loading ? (
                    <div className="indicator-search-no-results">Searching...</div>
                ) : results.length > 0 ? (
                    results.map((res, i) => (
                        <div
                            key={i}
                            className="indicator-search-item symbol-item"
                            onClick={() => {
                                onSelectSymbol(res.symbol);
                                onClose();
                            }}
                        >
                            <div className="symbol-item-main">
                                <span className="symbol-name">{res.symbol}</span>
                                <span className="symbol-type" style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>{res.type}</span>
                            </div>
                            <div className="symbol-item-desc" style={{ fontSize: '12px', opacity: 0.7 }}>
                                {res.name} • {res.exchange}
                            </div>
                        </div>
                    ))
                ) : query.trim() !== '' ? (
                    <div className="indicator-search-no-results">No results found</div>
                ) : (
                    <div className="indicator-search-no-results">Type symbol or name...</div>
                )}
            </div>
        </div>
    );
};

export default SymbolSearch;
