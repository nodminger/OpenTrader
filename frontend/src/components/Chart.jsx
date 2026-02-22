import React, { useEffect, useRef } from 'react';
import {
    createChart,
    ColorType,
    CandlestickSeries,
    LineSeries,
    HistogramSeries,
} from 'lightweight-charts';
import { computeSMA } from '../Indicators/sma';
import { computeRSI } from '../Indicators/rsi';
import { computeMACD } from '../Indicators/macd';

// Compute Heikin-Ashi candles from OHLCV data
function computeHeikinAshi(data) {
    const ha = [];
    for (let i = 0; i < data.length; i++) {
        const curr = data[i];
        const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
        const haOpen = i === 0
            ? (curr.open + curr.close) / 2
            : (ha[i - 1].open + ha[i - 1].close) / 2;
        const haHigh = Math.max(curr.high, haOpen, haClose);
        const haLow = Math.min(curr.low, haOpen, haClose);
        ha.push({ time: curr.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
    }
    return ha;
}

const Chart = ({
    data,
    chartType,
    symbol,
    interval,
    onVisibleLogicalRangeChange,
    onCrosshairMove,
    indicators = []
}) => {
    const containerRef = useRef();
    const chartRef = useRef(null);
    const priceSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const smaSeriesRef = useRef({});
    const rsiSeriesRef = useRef({});
    const macdSeriesRef = useRef({});
    const isFirstLoad = useRef(true);
    const lastSymbolInterval = useRef(`${symbol}-${interval}`);
    const lastChartType = useRef(chartType);

    const onRangeChangeRef = useRef(onVisibleLogicalRangeChange);
    const onCrosshairMoveRef = useRef(onCrosshairMove);
    useEffect(() => { onRangeChangeRef.current = onVisibleLogicalRangeChange; }, [onVisibleLogicalRangeChange]);
    useEffect(() => { onCrosshairMoveRef.current = onCrosshairMove; }, [onCrosshairMove]);

    useEffect(() => {
        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#2a2e39' },
                horzLines: { color: '#2a2e39' },
            },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                secondsVisible: false,
                shiftVisibleRangeOnNewBar: false,
                fixRightEdge: false,
                rightOffset: 20,
            },
            rightPriceScale: {
                borderColor: '#2a2e39',
                autoScale: true,
                alignLabels: true,
            },
            crosshair: {
                mode: 1,
            },
        });

        chartRef.current = chart;

        const rangeChangeHandler = (range) => {
            if (onRangeChangeRef.current) onRangeChangeRef.current(range);
        };
        chart.timeScale().subscribeVisibleLogicalRangeChange(rangeChangeHandler);

        const crosshairHandler = (param) => {
            if (!onCrosshairMoveRef.current) return;
            if (!param.time || !priceSeriesRef.current || param.point === undefined) {
                onCrosshairMoveRef.current(null);
                return;
            }

            const results = {
                price: param.seriesData.get(priceSeriesRef.current) ?? null,
                smas: {},
                rsis: {},
                macds: {}
            };

            Object.entries(smaSeriesRef.current).forEach(([id, series]) => {
                const data = param.seriesData.get(series);
                if (data) results.smas[id] = data.value;
            });

            Object.entries(rsiSeriesRef.current).forEach(([id, seriesArr]) => {
                const [main, smoothed, bbUpper, bbLower] = seriesArr;
                const mainVal = param.seriesData.get(main);
                const smoothVal = param.seriesData.get(smoothed);
                const bbuVal = param.seriesData.get(bbUpper);
                const bblVal = param.seriesData.get(bbLower);

                if (mainVal) {
                    results.rsis[id] = {
                        rsi: mainVal.value,
                        smoothed: smoothVal?.value ?? null,
                        bbUpper: bbuVal?.value ?? null,
                        bbLower: bblVal?.value ?? null
                    };
                }
            });

            Object.entries(macdSeriesRef.current).forEach(([id, seriesArr]) => {
                const [main, signal, hist] = seriesArr;
                const mainVal = param.seriesData.get(main);
                const signalVal = param.seriesData.get(signal);
                const histVal = param.seriesData.get(hist);

                if (mainVal) {
                    results.macds[id] = {
                        macd: mainVal.value,
                        signal: signalVal?.value ?? null,
                        histogram: histVal?.value ?? null
                    };
                }
            });

            onCrosshairMoveRef.current(results);
        };
        chart.subscribeCrosshairMove(crosshairHandler);

        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeChangeHandler);
            chart.unsubscribeCrosshairMove(crosshairHandler);
            chart.remove();
            chartRef.current = null;
            priceSeriesRef.current = null;
            volumeSeriesRef.current = null;
            smaSeriesRef.current = {};
            rsiSeriesRef.current = {};
            macdSeriesRef.current = {};
        };
    }, []);

    // Reset FirstLoad tracking on Symbol or Interval change
    useEffect(() => {
        const key = `${symbol}-${interval}`;
        if (lastSymbolInterval.current !== key) {
            isFirstLoad.current = true;
            lastSymbolInterval.current = key;
        }
    }, [symbol, interval]);

    // MAIN UPDATE LOOP: Price, Volume, and Indicators
    useEffect(() => {
        if (!chartRef.current || !data || data.length === 0) return;

        const hasRsi = indicators.some(i => i.type === 'rsi' && i.visible);
        const hasMacd = indicators.some(i => i.type === 'macd' && i.visible);
        const oscillatorCount = (hasRsi ? 1 : 0) + (hasMacd ? 1 : 0);

        // Core Layout Definitions
        let priceBottom = 0.08;
        let volTop = 0.82, volBottom = 0;
        let rsiMargins = { top: 0.80, bottom: 0.02 };
        let macdMargins = { top: 0.80, bottom: 0.02 };

        if (oscillatorCount === 1) {
            priceBottom = 0.40;
            volTop = 0.65; volBottom = 0.25;
            rsiMargins = { top: 0.80, bottom: 0.02 };
            macdMargins = { top: 0.80, bottom: 0.02 };
        } else if (oscillatorCount === 2) {
            priceBottom = 0.55;
            volTop = 0.48; volBottom = 0.40;
            rsiMargins = { top: 0.62, bottom: 0.20 };
            macdMargins = { top: 0.82, bottom: 0.02 };
        }

        // Apply Price & Volume Layout
        chartRef.current.priceScale('right').applyOptions({
            scaleMargins: { top: 0.02, bottom: priceBottom },
        });

        if (!volumeSeriesRef.current) {
            volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });
        }
        volumeSeriesRef.current.priceScale().applyOptions({ scaleMargins: { top: volTop, bottom: volBottom } });
        volumeSeriesRef.current.setData(data.map(d => ({
            time: d.time,
            value: d.volume || 0,
            color: d.close >= d.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
        })));

        // Handle Price Series Type (Candle/Line/Heikin)
        const typeChanged = lastChartType.current !== chartType;
        if (!priceSeriesRef.current || typeChanged) {
            if (priceSeriesRef.current) chartRef.current.removeSeries(priceSeriesRef.current);
            if (chartType === 'line') {
                priceSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#2962ff', lineWidth: 2 });
            } else {
                priceSeriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
                    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
                    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
                });
            }
            lastChartType.current = chartType;
        }

        const priceData = chartType === 'heikin'
            ? computeHeikinAshi(data)
            : (chartType === 'line' ? data.map(d => ({ time: d.time, value: d.close })) : data);
        priceSeriesRef.current.setData(priceData);

        // Indicator Series Management
        const currentIds = new Set(indicators.map(ind => ind.id));

        [smaSeriesRef, rsiSeriesRef, macdSeriesRef].forEach(ref => {
            Object.keys(ref.current).forEach(id => {
                if (!currentIds.has(id.split('_')[0])) {
                    try {
                        if (Array.isArray(ref.current[id])) {
                            ref.current[id].forEach(s => chartRef.current.removeSeries(s));
                        } else {
                            chartRef.current.removeSeries(ref.current[id]);
                        }
                    } catch (_) { }
                    delete ref.current[id];
                }
            });
        });

        indicators.forEach(ind => {
            if (ind.type === 'sma') {
                const existing = smaSeriesRef.current[ind.id];
                if (!ind.visible) {
                    if (existing) { try { chartRef.current.removeSeries(existing); } catch (_) { } delete smaSeriesRef.current[ind.id]; }
                    return;
                }
                const smaData = computeSMA(data, ind.length, ind.source);
                if (smaData.length === 0) return;
                if (existing) {
                    existing.applyOptions({ color: ind.color });
                    existing.setData(smaData);
                } else {
                    const s = chartRef.current.addSeries(LineSeries, { color: ind.color, lineWidth: 1.5, crosshairMarkerVisible: false, priceLineVisible: false });
                    s.setData(smaData);
                    smaSeriesRef.current[ind.id] = s;
                }
            }

            if (ind.type === 'rsi') {
                let existing = rsiSeriesRef.current[ind.id];
                if (!ind.visible) {
                    if (existing) { existing.forEach(s => chartRef.current.removeSeries(s)); delete rsiSeriesRef.current[ind.id]; }
                    return;
                }

                const results = computeRSI(data, ind);
                if (!existing) {
                    const paneOptions = { priceScaleId: 'rsi', lineWidth: 1.5, crosshairMarkerVisible: false, priceLineVisible: false };
                    const main = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: ind.color });
                    const smoothed = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: ind.smoothColor });
                    const bbU = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: ind.bbColor, lineStyle: 2, lineWidth: 1 });
                    const bbL = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: ind.bbColor, lineStyle: 2, lineWidth: 1 });
                    const base70 = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 1 });
                    const base30 = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 1 });

                    existing = [main, smoothed, bbU, bbL, base70, base30];
                    rsiSeriesRef.current[ind.id] = existing;
                }

                chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: rsiMargins, borderColor: '#2a2e39' });
                const [main, smoothed, bbU, bbL, base70, base30] = existing;

                // Always update baselines to match current data time range
                const times = data.map(d => ({ time: d.time }));
                base70.setData(times.map(t => ({ ...t, value: 70 })));
                base30.setData(times.map(t => ({ ...t, value: 30 })));

                main.setData(results.rsi);
                smoothed.setData(results.smoothed);
                bbU.setData(ind.showBB ? results.bbUpper : []);
                bbL.setData(ind.showBB ? results.bbLower : []);
            }

            if (ind.type === 'macd') {
                let existing = macdSeriesRef.current[ind.id];
                if (!ind.visible) {
                    if (existing) { existing.forEach(s => chartRef.current.removeSeries(s)); delete macdSeriesRef.current[ind.id]; }
                    return;
                }

                const results = computeMACD(data, ind);
                if (!existing) {
                    const paneOptions = { priceScaleId: 'macd', lineWidth: 1.5, crosshairMarkerVisible: false, priceLineVisible: false };
                    const hist = chartRef.current.addSeries(HistogramSeries, { priceScaleId: 'macd', color: '#26a69a', priceLineVisible: false });
                    const main = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: '#2962ff' });
                    const signal = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: '#ff9800' });
                    const baseline0 = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 1 });
                    const baseline1X = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: 'rgba(255,255,255,0.05)', lineWidth: 1, lineStyle: 2 });
                    const baseline1N = chartRef.current.addSeries(LineSeries, { ...paneOptions, color: 'rgba(255,255,255,0.05)', lineWidth: 1, lineStyle: 2 });

                    existing = [main, signal, hist, baseline0, baseline1X, baseline1N];
                    macdSeriesRef.current[ind.id] = existing;
                }

                chartRef.current.priceScale('macd').applyOptions({ scaleMargins: macdMargins, borderColor: '#2a2e39' });
                const [main, signal, hist, b0, b1x, b1n] = existing;

                // Always update baselines to match current data time range
                const times = data.map(d => ({ time: d.time }));
                b0.setData(times.map(t => ({ ...t, value: 0 })));
                b1x.setData(times.map(t => ({ ...t, value: 1 })));
                b1n.setData(times.map(t => ({ ...t, value: -1 })));

                main.setData(results.macd);
                signal.setData(results.signal);
                hist.setData(results.histogram);
            }
        });

        // Fit Content and set initial visible range on new data load
        if (isFirstLoad.current && data.length > 0) {
            const timeScale = chartRef.current.timeScale();
            timeScale.fitContent();

            // Standard TradingView-style right offset
            const logicalRange = timeScale.getVisibleLogicalRange();
            if (logicalRange) {
                timeScale.setVisibleLogicalRange({
                    from: logicalRange.from,
                    to: logicalRange.to + 20,
                });
            }
            isFirstLoad.current = false;
        }
    }, [data, chartType, indicators, symbol, interval]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default Chart;
