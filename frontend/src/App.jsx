import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import TopBar from './components/TopBar';
import Chart from './components/Chart';
import IndicatorPanel from './components/IndicatorPanel';
import IndicatorSearch from './components/IndicatorSearch';
import SymbolSearch from './components/SymbolSearch';
import { SMA_COLORS } from './Indicators/sma';

const STORAGE_KEY = 'opentrader_settings';

function App() {
  // Load initial settings from localStorage
  const getSavedSettings = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Failed to load settings:', e);
      return {};
    }
  };

  const savedSettings = getSavedSettings();

  const [symbol, setSymbol] = useState(savedSettings.symbol || 'AAPL');
  const [interval, setTimeInterval] = useState(savedSettings.interval || '1d');
  const [chartType, setChartType] = useState(savedSettings.chartType || 'candle');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredData, setHoveredData] = useState(null);
  const [indicators, setIndicators] = useState(savedSettings.indicators || []);
  const [showIndicatorSearch, setShowIndicatorSearch] = useState(false);
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const loadingMoreRef = useRef(false);

  // Persistence Hook: Save settings whenever they change
  useEffect(() => {
    const settings = {
      symbol,
      interval,
      chartType,
      indicators
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [symbol, interval, chartType, indicators]);

  const fetchMoreDataRef = useRef(null);
  const isValidNum = (v) => typeof v === 'number' && isFinite(v);

  const fetchData = async (signal) => {
    setLoading(true);
    setError(null);
    try {
      let range = '1y';
      if (['1m', '5m', '15m'].includes(interval)) range = '5d';
      else if (['1h', '4h'].includes(interval)) range = '1mo';

      const response = await axios.get('/api/history/', {
        params: { symbol, interval, range },
        signal
      });

      const uniqueData = Array.from(new Map(response.data
        .filter(d => d.time != null)
        .map(d => {
          // Normalize timestamp: detect and convert milliseconds if needed
          let t = Number(d.time);
          if (t > 1e11) t = Math.floor(t / 1000); // Likely ms -> s
          else t = Math.floor(t);

          return [t, {
            ...d,
            time: t,
            open: isValidNum(d.open) ? d.open : d.close,
            high: isValidNum(d.high) ? d.high : d.close,
            low: isValidNum(d.low) ? d.low : d.close,
            close: isValidNum(d.close) ? d.close : d.open // Fallback
          }];
        })
        .filter(d => isValidNum(d[1].close))
        .map(d => [d[0], d[1]])).values())
        .sort((a, b) => a.time - b.time);

      setData(uniqueData);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error('Fetch error:', err);
      setError('Failed to load data for ' + symbol);
      setData([]);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  const refreshData = async () => {
    if (loading || loadingMore || loadingMoreRef.current || data.length === 0) return;
    try {
      let range = '1d';
      if (['1wk', '1mo'].includes(interval)) range = '1mo';
      const response = await axios.get('/api/history/', {
        params: { symbol, interval, range },
      });
      if (response.data && response.data.length > 0) {
        setData(prev => {
          const newData = response.data.map(d => {
            let t = Number(d.time);
            if (t > 1e11) t = Math.floor(t / 1000);
            else t = Math.floor(t);
            return {
              ...d,
              time: t,
              open: isValidNum(d.open) ? d.open : d.close,
              high: isValidNum(d.high) ? d.high : d.close,
              low: isValidNum(d.low) ? d.low : d.close,
              close: isValidNum(d.close) ? d.close : d.open
            };
          }).filter(d => isValidNum(d.close));

          const combined = [...prev, ...newData];
          return Array.from(new Map(combined.map(d => [d.time, d])).values())
            .sort((a, b) => a.time - b.time);
        });
      }
    } catch (err) {
      console.warn('Real-time refresh failed:', err);
    }
  };

  const fetchMoreData = async () => {
    if (loading || loadingMore || loadingMoreRef.current || data.length === 0) return;

    const firstTime = data[0].time;
    // ... calculate start/end ...
    const offset = (interval === '1m') ? 2 * 24 * 60 * 60 :
      (['5m', '15m'].includes(interval)) ? 7 * 24 * 60 * 60 :
        (['1h', '4h'].includes(interval)) ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60;

    const start = firstTime - offset;
    const end = firstTime;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const response = await axios.get('/api/history/', {
        params: { symbol, interval, start, end },
      });
      if (response.data && response.data.length > 0) {
        setData(prev => {
          const newData = response.data.map(d => {
            let t = Number(d.time);
            if (t > 1e11) t = Math.floor(t / 1000);
            else t = Math.floor(t);
            return {
              ...d,
              time: t,
              open: isValidNum(d.open) ? d.open : d.close,
              high: isValidNum(d.high) ? d.high : d.close,
              low: isValidNum(d.low) ? d.low : d.close,
              close: isValidNum(d.close) ? d.close : d.open
            };
          }).filter(d => isValidNum(d.close));

          const combined = [...newData, ...prev];
          return Array.from(new Map(combined.map(d => [d.time, d])).values())
            .sort((a, b) => a.time - b.time);
        });
      }
    } catch (err) {
      console.error('Fetch more error:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  fetchMoreDataRef.current = fetchMoreData;

  const handleVisibleLogicalRangeChange = useCallback((range) => {
    if (range && range.from < 50) {
      fetchMoreDataRef.current?.();
    }
  }, []);

  const handleCrosshairMove = useCallback((d) => {
    setHoveredData(d);
  }, []);

  const DEFAULT_SMA_LENGTHS = [5, 10, 20, 50, 100, 200, 7, 14, 30, 150];

  const addIndicator = (type) => {
    if (type === 'rsi' && indicators.some(i => i.type === 'rsi')) return;
    if (type === 'macd' && indicators.some(i => i.type === 'macd')) return;

    if (type === 'sma') {
      const slots = DEFAULT_SMA_LENGTHS.map((length, i) => ({
        id: `sma-${i}`,
        type: 'sma',
        length,
        source: 'close',
        visible: i < 3,
        color: SMA_COLORS[i],
      }));
      setIndicators(prev => [...prev, ...slots]);
    }

    if (type === 'rsi') {
      setIndicators(prev => [...prev, {
        id: 'rsi-main',
        type: 'rsi',
        length: 14,
        source: 'close',
        visible: true,
        smoothingType: 'SMA',
        smoothingLength: 10,
        showBB: true,
        color: '#2962ff',
        smoothColor: '#ff9800',
        bbColor: 'rgba(255, 255, 255, 0.3)'
      }]);
    }

    if (type === 'macd') {
      setIndicators(prev => [...prev, {
        id: 'macd-main',
        type: 'macd',
        fastLength: 12,
        slowLength: 26,
        signalLength: 9,
        normLookback: 100,
        visible: true,
        color: '#2962ff',
        signalColor: '#ff9800',
      }]);
    }
  };

  const updateIndicator = (id, updates) => {
    setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind));
  };

  const removeIndicator = (id) => {
    setIndicators(prev => prev.filter(ind => ind.id !== id));
  };

  const removeIndicatorGroup = (type) => {
    setIndicators(prev => prev.filter(ind => ind.type !== type));
  };

  const removeAllIndicators = () => {
    setIndicators([]);
  };

  const toggleIndicator = (id) => {
    setIndicators(prev => prev.map(ind => ind.id === id ? { ...ind, visible: !ind.visible } : ind));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [symbol, interval]);

  useEffect(() => {
    let ms = 60000;
    if (['1m', '5m', '15m'].includes(interval)) ms = 10000;
    else if (['1h', '4h'].includes(interval)) ms = 30000;

    const intervalId = setInterval(() => {
      refreshData();
    }, ms);

    return () => clearInterval(intervalId);
  }, [symbol, interval, data.length]);

  const formatPrice = (price) => (price != null ? price.toFixed(2) : '');
  const formatPercent = (val) => (val != null ? (val >= 0 ? '+' : '') + val.toFixed(2) + '%' : '');

  const priceData = hoveredData?.price;
  const pnl = priceData ? ((priceData.close - priceData.open) / priceData.open * 100) : null;
  const pnlColor = pnl >= 0 ? '#26a69a' : '#ef5350';

  const activeRsi = indicators.find(i => i.type === 'rsi' && i.visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <TopBar
        symbol={symbol} setSymbol={setSymbol}
        interval={interval} setInterval={setTimeInterval}
        chartType={chartType} setChartType={setChartType}
        openIndicatorSearch={() => setShowIndicatorSearch(true)}
        openSymbolSearch={() => setShowSymbolSearch(true)}
      />
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>

        {/* TOP LEGEND (Main OHLC) */}
        <div className="chart-legend-main">
          <div className="legend-symbol">{symbol}</div>
          {priceData && (
            <div className="legend-ohlc">
              <span className="ohlc-item"><span className="ohlc-label">O</span><span style={{ color: pnlColor }}>{formatPrice(priceData.open)}</span></span>
              <span className="ohlc-item"><span className="ohlc-label">H</span><span style={{ color: pnlColor }}>{formatPrice(priceData.high)}</span></span>
              <span className="ohlc-item"><span className="ohlc-label">L</span><span style={{ color: pnlColor }}>{formatPrice(priceData.low)}</span></span>
              <span className="ohlc-item"><span className="ohlc-label">C</span><span style={{ color: pnlColor }}>{formatPrice(priceData.close)}</span></span>
              <span style={{ color: pnlColor, fontWeight: 'bold' }}>{formatPercent(pnl)}</span>
            </div>
          )}
        </div>

        {/* SMA LEGENDS (Just below OHLC) */}
        <div className="chart-legend-indicators price-indicators">
          {indicators.filter(i => i.type === 'sma' && i.visible).map(ind => {
            const val = hoveredData?.smas?.[ind.id];
            return (
              <div key={ind.id} className="legend-item">
                <span className="legend-bullet" style={{ backgroundColor: ind.color }}></span>
                <span className="legend-label">SMA {ind.length}</span>
                <span className="legend-value" style={{ color: ind.color }}>{val != null ? val.toFixed(2) : ''}</span>
              </div>
            );
          })}
        </div>

        {/* RSI LEGEND (In the RSI pane area) */}
        {activeRsi && (
          <div className="chart-legend-indicators rsi-pane-indicators">
            <div className="legend-item">
              <span className="legend-bullet" style={{ backgroundColor: activeRsi.color }}></span>
              <span className="legend-label">RSI ({activeRsi.length}, {activeRsi.source})</span>
              <span className="legend-value" style={{ color: activeRsi.color }}>
                {hoveredData?.rsis?.[activeRsi.id]?.rsi?.toFixed(2) || ''}
              </span>
            </div>
            {activeRsi.smoothingType === 'SMA' && (
              <div className="legend-item">
                <span className="legend-bullet" style={{ backgroundColor: activeRsi.smoothColor }}></span>
                <span className="legend-label">Smooth ({activeRsi.smoothingLength})</span>
                <span className="legend-value" style={{ color: activeRsi.smoothColor }}>
                  {hoveredData?.rsis?.[activeRsi.id]?.smoothed?.toFixed(2) || ''}
                </span>
              </div>
            )}
            {activeRsi.showBB && (
              <div className="legend-item">
                <span className="legend-label" style={{ opacity: 0.5 }}>BB (2)</span>
                <span className="legend-value" style={{ color: activeRsi.bbColor }}>
                  {hoveredData?.rsis?.[activeRsi.id]?.bbUpper?.toFixed(2) || ''} / {hoveredData?.rsis?.[activeRsi.id]?.bbLower?.toFixed(2) || ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* MACD LEGEND */}
        {indicators.find(i => i.type === 'macd' && i.visible) && (
          <div className="chart-legend-indicators macd-pane-indicators">
            <div className="legend-item">
              <span className="legend-bullet" style={{ backgroundColor: '#2962ff' }}></span>
              <span className="legend-label">MACD</span>
              <span className="legend-value" style={{ color: '#2962ff' }}>
                {hoveredData?.macds?.['macd-main']?.macd?.toFixed(3) || ''}
              </span>
            </div>
            <div className="legend-item">
              <span className="legend-bullet" style={{ backgroundColor: '#ff9800' }}></span>
              <span className="legend-label">Signal</span>
              <span className="legend-value" style={{ color: '#ff9800' }}>
                {hoveredData?.macds?.['macd-main']?.signal?.toFixed(3) || ''}
              </span>
            </div>
            <div className="legend-item">
              <span className="legend-label">Hist</span>
              <span className="legend-value">
                {hoveredData?.macds?.['macd-main']?.histogram?.toFixed(3) || ''}
              </span>
            </div>
          </div>
        )}

        {showIndicatorSearch && (
          <IndicatorSearch
            onAddIndicator={addIndicator}
            onClose={() => setShowIndicatorSearch(false)}
          />
        )}

        {showSymbolSearch && (
          <SymbolSearch
            onSelectSymbol={setSymbol}
            onClose={() => setShowSymbolSearch(false)}
          />
        )}

        <div className="indicator-panels-container">
          {/* Moving Averages Panel */}
          <IndicatorPanel
            title="Moving Averages"
            groupType="sma"
            indicators={indicators.filter(i => i.type === 'sma')}
            updateIndicator={updateIndicator}
            removeIndicator={removeIndicator}
            removeIndicatorGroup={removeIndicatorGroup}
            toggleIndicator={toggleIndicator}
          />
          {/* RSI Panel */}
          <IndicatorPanel
            title="Relative Strength Index"
            groupType="rsi"
            indicators={indicators.filter(i => i.type === 'rsi')}
            updateIndicator={updateIndicator}
            removeIndicator={removeIndicator}
            removeIndicatorGroup={removeIndicatorGroup}
            toggleIndicator={toggleIndicator}
          />
          {/* MACD Panel */}
          <IndicatorPanel
            title="Normalized MACD"
            groupType="macd"
            indicators={indicators.filter(i => i.type === 'macd')}
            updateIndicator={updateIndicator}
            removeIndicator={removeIndicator}
            removeIndicatorGroup={removeIndicatorGroup}
            toggleIndicator={toggleIndicator}
          />
        </div>

        {loading && (
          <div className="chart-loader initial-loader">
            Loading {symbol}...
          </div>
        )}
        {loadingMore && (
          <div className="chart-loader more-loader">
            Fetching historical data...
          </div>
        )}
        {error && !loading && (
          <div className="chart-error-overlay">
            {error}
          </div>
        )}
        {data.length > 0 && (
          <Chart
            data={data}
            chartType={chartType}
            symbol={symbol}
            interval={interval}
            indicators={indicators}
            onVisibleLogicalRangeChange={handleVisibleLogicalRangeChange}
            onCrosshairMove={handleCrosshairMove}
          />
        )}
      </div>
    </div>
  );
}

export default App;
