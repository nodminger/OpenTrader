import React, { useEffect, useRef, useState } from 'react';
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
import { computeVolumeProfile } from '../Indicators/volumeProfile';

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
    const vpRef = useRef(null);
    const [vpBins, setVpBins] = useState([]);

    const isFirstLoad = useRef(true);
    const lastSymbolInterval = useRef(`${symbol}-${interval}`);
    const lastChartType = useRef(chartType);

    const onRangeChangeRef = useRef(onVisibleLogicalRangeChange);
    const onCrosshairMoveRef = useRef(onCrosshairMove);
    useEffect(() => { onRangeChangeRef.current = onVisibleLogicalRangeChange; }, [onVisibleLogicalRangeChange]);
    useEffect(() => { onCrosshairMoveRef.current = onCrosshairMove; }, [onCrosshairMove]);

    // Initialize Chart
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

    // Sync VP SVG Overlays
    useEffect(() => {
        if (!chartRef.current || !vpRef.current) return;
        const svg = vpRef.current;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const vpInd = indicators.find(i => i.type === 'volume_profile' && i.visible);
        if (!vpInd || vpBins.length === 0 || !priceSeriesRef.current) return;

        const pScale = priceSeriesRef.current.priceScale();
        const width = containerRef.current.clientWidth;

        vpBins.forEach(bin => {
            const y1 = priceSeriesRef.current.priceToCoordinate(bin.low);
            const y2 = priceSeriesRef.current.priceToCoordinate(bin.high);
            if (y1 === null || y2 === null) return;

            const height = Math.abs(y2 - y1);
            const y = Math.min(y1, y2);
            const barWidth = (width * 0.3) * bin.normalizedVolume;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (width - barWidth).toString());
            rect.setAttribute('y', y.toString());
            rect.setAttribute('width', barWidth.toString());
            rect.setAttribute('height', Math.max(1, height - 1).toString());
            rect.setAttribute('fill', vpInd.color);
            svg.appendChild(rect);
        });
    }, [vpBins, indicators]);

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

        // Layout margins
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

        chartRef.current.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: priceBottom } });

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

        const priceData = chartType === 'heikin' ? computeHeikinAshi(data) : (chartType === 'line' ? data.map(d => ({ time: d.time, value: d.close })) : data);
        priceSeriesRef.current.setData(priceData);

        // Indicator Management
        const currentIds = new Set(indicators.map(ind => ind.id));
        [smaSeriesRef, rsiSeriesRef, macdSeriesRef].forEach(ref => {
            Object.keys(ref.current).forEach(id => {
                if (!currentIds.has(id)) {
                    try {
                        if (Array.isArray(ref.current[id])) ref.current[id].forEach(s => chartRef.current.removeSeries(s));
                        else chartRef.current.removeSeries(ref.current[id]);
                    } catch (_) { }
                    delete ref.current[id];
                }
            });
        });

        let vpActive = false;
        indicators.forEach(ind => {
            if (ind.type === 'sma' && ind.visible) {
                const existing = smaSeriesRef.current[ind.id];
                const smaData = computeSMA(data, ind.length, ind.source);
                if (existing) { existing.applyOptions({ color: ind.color }); existing.setData(smaData); }
                else { const s = chartRef.current.addSeries(LineSeries, { color: ind.color, lineWidth: 1.5, crosshairMarkerVisible: false }); s.setData(smaData); smaSeriesRef.current[ind.id] = s; }
            }
            if (ind.type === 'rsi' && ind.visible) {
                let existing = rsiSeriesRef.current[ind.id];
                const results = computeRSI(data, ind);
                if (!existing) {
                    const opts = { priceScaleId: 'rsi', lineWidth: 1.5, crosshairMarkerVisible: false };
                    existing = [
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.color }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.smoothColor }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.bbColor, lineStyle: 2 }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.bbColor, lineStyle: 2 }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.1)' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.1)' })
                    ];
                    rsiSeriesRef.current[ind.id] = existing;
                }
                chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: rsiMargins });
                const [m, s, bu, bl, b70, b30] = existing;
                const times = data.map(d => ({ time: d.time }));
                b70.setData(times.map(t => ({ ...t, value: 70 }))); b30.setData(times.map(t => ({ ...t, value: 30 })));
                m.setData(results.rsi); s.setData(results.smoothed); bu.setData(ind.showBB ? results.bbUpper : []); bl.setData(ind.showBB ? results.bbLower : []);
            }
            if (ind.type === 'macd' && ind.visible) {
                let existing = macdSeriesRef.current[ind.id];
                const res = computeMACD(data, ind);
                if (!existing) {
                    const opts = { priceScaleId: 'macd', lineWidth: 1.5, crosshairMarkerVisible: false };
                    existing = [
                        chartRef.current.addSeries(LineSeries, { ...opts, color: '#2962ff' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: '#ff9800' }),
                        chartRef.current.addSeries(HistogramSeries, { priceScaleId: 'macd' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.1)' })
                    ];
                    macdSeriesRef.current[ind.id] = existing;
                }
                chartRef.current.priceScale('macd').applyOptions({ scaleMargins: macdMargins });
                const [m, s, h, b0] = existing;
                const times = data.map(d => ({ time: d.time }));
                b0.setData(times.map(t => ({ ...t, value: 0 })));
                m.setData(res.macd); s.setData(res.signal); h.setData(res.histogram);
            }
            if (ind.type === 'volume_profile' && ind.visible) {
                setVpBins(computeVolumeProfile(data, ind));
                vpActive = true;
            }
        });
        if (!vpActive) setVpBins([]);

        if (isFirstLoad.current && data.length > 0) {
            const timeScale = chartRef.current.timeScale();
            timeScale.fitContent();
            const lr = timeScale.getVisibleLogicalRange();
            if (lr) timeScale.setVisibleLogicalRange({ from: lr.from, to: lr.to + 20 });
            isFirstLoad.current = false;
        }
    }, [data, chartType, indicators, symbol, interval]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            <svg ref={vpRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
        </div>
    );
};

export default Chart;
