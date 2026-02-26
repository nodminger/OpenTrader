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
import { computeBollingerBands } from '../Indicators/bollinger';
import { computeStochastic } from '../Indicators/stoch';
import { computeSuperTrend } from '../Indicators/supertrend';
import { computeATR } from '../Indicators/atr';
import { computeIchimoku } from '../Indicators/ichimoku';
import { computeTSI } from '../Indicators/tsi';

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

// Custom primitive to sync SVG with chart movements
class SyncPrimitive {
    constructor(callback) {
        this._callback = callback;
    }
    updateAllViews() {
        this._callback();
    }
    paneViews() { return []; }
    priceAxisViews() { return []; }
    timeAxisViews() { return []; }
}

const Chart = ({
    data,
    chartType,
    symbol,
    interval,
    onVisibleLogicalRangeChange,
    onCrosshairMove,
    indicators = [],
    drawings = [],
    setDrawings,
    activeTool,
    setActiveTool
}) => {
    const containerRef = useRef();
    const chartRef = useRef(null);
    const priceSeriesRef = useRef(null);
    const drawingRef = useRef(null);
    const [previewDrawing, setPreviewDrawing] = useState(null);
    const drawingPointsRef = useRef([]);
    const volumeSeriesRef = useRef(null);
    const smaSeriesRef = useRef({});
    const rsiSeriesRef = useRef({});
    const macdSeriesRef = useRef({});
    const bbSeriesRef = useRef({});
    const stochSeriesRef = useRef({});
    const supertrendSeriesRef = useRef({});
    const atrSeriesRef = useRef({});
    const ichimokuSeriesRef = useRef({});
    const tsiSeriesRef = useRef({});
    const vpRef = useRef(null);
    const bbFillRef = useRef(null);
    const ichimokuFillRef = useRef(null);
    const [vpBins, setVpBins] = useState([]);
    const [bbFillData, setBbFillData] = useState(null);
    const [ichimokuFillData, setIchimokuFillData] = useState(null);
    const [chartTick, setChartTick] = useState(0);

    const isFirstLoad = useRef(true);
    const lastSymbolInterval = useRef(`${symbol}-${interval}`);
    const lastChartType = useRef(chartType);

    const onRangeChangeRef = useRef(onVisibleLogicalRangeChange);
    const onCrosshairMoveRef = useRef(onCrosshairMove);
    const activeToolRef = useRef(activeTool);
    useEffect(() => { onRangeChangeRef.current = onVisibleLogicalRangeChange; }, [onVisibleLogicalRangeChange]);
    useEffect(() => { onCrosshairMoveRef.current = onCrosshairMove; }, [onCrosshairMove]);
    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

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
            const currentTool = activeToolRef.current;
            if (currentTool && currentTool !== 'cursor' && param.point && priceSeriesRef.current) {
                const time = param.time;
                const price = priceSeriesRef.current.coordinateToPrice(param.point.y);

                if (drawingPointsRef.current.length > 0) {
                    setPreviewDrawing({
                        type: currentTool,
                        points: [...drawingPointsRef.current, { time, price }],
                        p1: drawingPointsRef.current[0], // backward compatibility
                        p2: { time, price }
                    });
                }
            }

            if (!onCrosshairMoveRef.current) return;
            if (!param.time || !priceSeriesRef.current || param.point === undefined) {
                onCrosshairMoveRef.current(null);
                return;
            }

            const results = {
                price: param.seriesData.get(priceSeriesRef.current) ?? null,
                smas: {},
                rsis: {},
                macds: {},
                bbs: {},
                stochs: {},
                supertrend: {},
                atrs: {},
                ichimoku: {},
                tsi: {},
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

            Object.entries(bbSeriesRef.current).forEach(([id, seriesArr]) => {
                const [basis, upper, lower] = seriesArr;
                const bVal = param.seriesData.get(basis);
                const uVal = param.seriesData.get(upper);
                const lVal = param.seriesData.get(lower);
                if (bVal) {
                    results.bbs[id] = {
                        basis: bVal.value,
                        upper: uVal?.value ?? null,
                        lower: lVal?.value ?? null
                    };
                }
            });

            Object.entries(stochSeriesRef.current).forEach(([id, seriesArr]) => {
                const [k, d] = seriesArr;
                const kVal = param.seriesData.get(k);
                const dVal = param.seriesData.get(d);
                if (kVal) {
                    results.stochs[id] = {
                        k: kVal.value,
                        d: dVal?.value ?? null
                    };
                }
            });

            Object.entries(supertrendSeriesRef.current || {}).forEach(([id, seriesArr]) => {
                const [upS, downS] = seriesArr;
                const upVal = param.seriesData.get(upS);
                const downVal = param.seriesData.get(downS);

                if (upVal) {
                    results.supertrend[id] = { value: upVal.value, trend: 1 };
                } else if (downVal) {
                    results.supertrend[id] = { value: downVal.value, trend: -1 };
                }
            });

            Object.entries(atrSeriesRef.current || {}).forEach(([id, series]) => {
                const val = param.seriesData.get(series);
                if (val) {
                    results.atrs[id] = { value: val.value };
                }
            });

            Object.entries(ichimokuSeriesRef.current).forEach(([id, seriesArr]) => {
                const [tenkan, kijun, spanA, spanB, chikou] = seriesArr;
                results.ichimoku[id] = {
                    tenkan: param.seriesData.get(tenkan)?.value ?? null,
                    kijun: param.seriesData.get(kijun)?.value ?? null,
                    spanA: param.seriesData.get(spanA)?.value ?? null,
                    spanB: param.seriesData.get(spanB)?.value ?? null,
                    chikou: param.seriesData.get(chikou)?.value ?? null
                };
            });

            Object.entries(tsiSeriesRef.current).forEach(([id, seriesArr]) => {
                const [tsi, signal] = seriesArr;
                results.tsi[id] = {
                    tsi: param.seriesData.get(tsi)?.value ?? null,
                    signal: param.seriesData.get(signal)?.value ?? null
                };
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
            bbSeriesRef.current = {};
            stochSeriesRef.current = {};
            supertrendSeriesRef.current = {};
            atrSeriesRef.current = {};
            ichimokuSeriesRef.current = {};
            tsiSeriesRef.current = {};
        };
    }, []); // Removed [activeTool] to prevent chart recreation

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'z') {
                setDrawings(prev => prev.slice(0, -1));
                drawingPointsRef.current = [];
                setPreviewDrawing(null);
                setActiveTool('cursor');
            }
            if (e.key === 'Escape') {
                setActiveTool('cursor');
                drawingPointsRef.current = [];
                setPreviewDrawing(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setDrawings, setActiveTool]);

    // Handle Clicks for Drawing
    useEffect(() => {
        if (!chartRef.current || !activeTool || activeTool === 'cursor') {
            drawingPointsRef.current = [];
            setPreviewDrawing(null);
            return;
        }

        const clickHandler = (param) => {
            if (!param.point || !priceSeriesRef.current) return;
            const time = param.time;
            const price = priceSeriesRef.current.coordinateToPrice(param.point.y);

            const points = drawingPointsRef.current;

            if (activeTool === 'horizontalLine' || activeTool === 'verticalLine' || activeTool === 'horizontalRay' || activeTool === 'crossLine') {
                const newDrawing = {
                    id: Date.now().toString(),
                    type: activeTool,
                    points: [{ time, price }],
                    p1: { time, price },
                    p2: { time, price }, // Some tools might need same values initially
                    color: '#2962ff',
                    lineWidth: 2
                };
                setDrawings(prev => [...prev, newDrawing]);
                setActiveTool('cursor');
                return;
            }

            // For multi-point tools
            const newPoints = [...points, { time, price }];
            drawingPointsRef.current = newPoints;

            const requiredPoints = {
                trend: 2,
                arrow: 2,
                ray: 2,
                extendedLine: 2,
                infoLine: 2,
                trendAngle: 2,
                rectangle: 2,
                rotatedRectangle: 3,
                circle: 2,
                ellipse: 2,
                triangle: 3,
                polyline: 4,
                curve: 3,
                doubleCurve: 4,
                arc: 3,
                xabcd: 5,
                cypher: 5,
                abcd: 4,
                threeDrives: 6,
                shark: 5,
                fiveO: 6,
                elliottImpulse: 5,
                elliottCorrection: 3,
                elliottTriangle: 5,
                elliottDoubleCombo: 3,
                elliottTripleCombo: 5,
                headAndShoulders: 7,
                trianglePattern: 4,
                wedgePattern: 4,
                rectanglePattern: 4,
                channelPattern: 3,
                doubleTop: 5,
                doubleBottom: 5,
                pitchfork: 3,
                schiffPitchfork: 3,
                modifiedSchiffPitchfork: 3,
                insidePitchfork: 3,
                regressionChannel: 3,
                buyLabel: 1,
                sellLabel: 1,
                arrowMark: 1,
                longPosition: 2,
                shortPosition: 2,
                riskReward: 2,
                forecast: 2,
                priceRange: 2,
                dateRange: 2,
                ghostFeed: 2,
                fibRetracement: 2,
                fibExtension: 3,
                fibSpeedArcs: 2,
                fibFan: 2,
                fibTimeZone: 2,
                fibChannel: 3,
                fibWedge: 3,
                fibSpiral: 2,
                fibCircles: 2,
                gannFan: 2,
                gannSquare: 2,
                gannBox: 2,
                parallelChannel: 3,
                flatTopBottom: 3,
                disjointChannel: 4,
                regressionTrend: 2,
                ellipse: 2,
                triangle: 3
            };

            if (newPoints.length >= requiredPoints[activeTool]) {
                const newDrawing = {
                    id: Date.now().toString(),
                    type: activeTool,
                    points: newPoints,
                    p1: newPoints[0],
                    p2: newPoints[1],
                    color: '#2962ff',
                    lineWidth: 2
                };
                setDrawings(prev => [...prev, newDrawing]);
                drawingPointsRef.current = [];
                setPreviewDrawing(null);
                setActiveTool('cursor');
            }
        };

        chartRef.current.subscribeClick(clickHandler);
        return () => {
            if (chartRef.current) chartRef.current.unsubscribeClick(clickHandler);
        };
    }, [activeTool, setDrawings, setActiveTool]);

    // Sync BB Background Shade
    useEffect(() => {
        if (!chartRef.current || !bbFillRef.current || !bbFillData || !priceSeriesRef.current) return;
        const svg = bbFillRef.current;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const bbInd = indicators.find(i => i.type === 'bb' && i.visible);
        if (!bbInd) return;

        const { upper, lower } = bbFillData;
        if (upper.length === 0 || lower.length === 0) return;

        const ts = chartRef.current.timeScale();
        const points = [];

        // Build the shaded polygon
        // Forward through upper band
        upper.forEach(p => {
            const x = ts.timeToCoordinate(p.time);
            const y = priceSeriesRef.current.priceToCoordinate(p.value);
            if (x !== null && y !== null) points.push(`${x},${y}`);
        });
        // Backward through lower band
        for (let i = lower.length - 1; i >= 0; i--) {
            const p = lower[i];
            const x = ts.timeToCoordinate(p.time);
            const y = priceSeriesRef.current.priceToCoordinate(p.value);
            if (x !== null && y !== null) points.push(`${x},${y}`);
        }

        if (points.length > 0) {
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', points.join(' '));
            poly.setAttribute('fill', bbInd.fillColor);
            svg.appendChild(poly);
        }
    }, [bbFillData, indicators, data]); // Redraw on data change as well to sync with timeScale

    // Sync VP SVG Overlays
    useEffect(() => {
        if (!chartRef.current || !vpRef.current) return;
        const svg = vpRef.current;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const vpInd = indicators.find(i => i.type === 'volume_profile' && i.visible);
        if (!vpInd || vpBins.length === 0 || !priceSeriesRef.current) return;

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

    // Ichimoku Cloud Fill
    useEffect(() => {
        if (!chartRef.current || !ichimokuFillRef.current || !ichimokuFillData || !priceSeriesRef.current) return;
        const svg = ichimokuFillRef.current;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const ind = indicators.find(i => i.type === 'ichimoku' && i.visible);
        if (!ind) return;

        const { spanA, spanB } = ichimokuFillData;
        if (spanA.length === 0 || spanB.length === 0) return;

        const ts = chartRef.current.timeScale();

        // Group points into segments where trend is constant to support two-tone cloud
        let currentSegment = [];
        let currentTrend = null; // true for A > B, false for A < B

        for (let i = 0; i < spanA.length; i++) {
            const pA = spanA[i];
            const pB = spanB.find(b => b.time === pA.time);
            if (!pB) continue;

            const trend = pA.value >= pB.value;
            if (currentTrend === null) currentTrend = trend;

            if (trend !== currentTrend) {
                // Flash current segment
                drawSegment(currentSegment, currentTrend);
                currentSegment = [currentSegment[currentSegment.length - 1]]; // Start next segment from last point
                currentTrend = trend;
            }
            currentSegment.push({ time: pA.time, a: pA.value, b: pB.value });
        }
        if (currentSegment.length > 1) drawSegment(currentSegment, currentTrend);

        function drawSegment(seg, trend) {
            const points = [];
            // Forward through Span A
            seg.forEach(p => {
                const x = ts.timeToCoordinate(p.time);
                const y = priceSeriesRef.current.priceToCoordinate(p.a);
                if (x !== null && y !== null) points.push(`${x},${y}`);
            });
            // Backward through Span B
            for (let i = seg.length - 1; i >= 0; i--) {
                const p = seg[i];
                const x = ts.timeToCoordinate(p.time);
                const y = priceSeriesRef.current.priceToCoordinate(p.b);
                if (x !== null && y !== null) points.push(`${x},${y}`);
            }

            if (points.length > 2) {
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                poly.setAttribute('points', points.join(' '));
                poly.setAttribute('fill', trend ? ind.spanAColor : ind.spanBColor);
                svg.appendChild(poly);
            }
        }
    }, [ichimokuFillData, indicators, data]);

    // Render Drawings and Annotations
    useEffect(() => {
        if (!chartRef.current || !drawingRef.current || !priceSeriesRef.current || !containerRef.current) return;
        const svg = drawingRef.current;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const ts = chartRef.current.timeScale();
        const ps = priceSeriesRef.current;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const allDrawings = [...drawings, ...(previewDrawing ? [previewDrawing] : [])];

        allDrawings.forEach(d => {
            if (!d.p1) return;
            const x1 = ts.timeToCoordinate(d.p1.time);
            const y1 = ps.priceToCoordinate(d.p1.price);

            if (x1 === null || y1 === null) return;

            let x2 = d.p2 ? ts.timeToCoordinate(d.p2.time) : null;
            let y2 = d.p2 ? ps.priceToCoordinate(d.p2.price) : null;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('stroke', d.color || '#2962ff');
            line.setAttribute('stroke-width', d.lineWidth || 2);
            line.setAttribute('stroke-linecap', 'round');

            if (['xabcd', 'cypher', 'abcd', 'threeDrives', 'shark', 'fiveO'].includes(d.type) && d.points.length >= 2) {
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                const pts = d.points.map(p => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    return (px !== null && py !== null) ? `${px},${py}` : '';
                }).filter(s => s).join(' ');
                poly.setAttribute('points', pts);
                poly.setAttribute('stroke', d.color || '#2962ff');
                poly.setAttribute('stroke-width', d.lineWidth || 2);
                poly.setAttribute('fill', 'none');
                poly.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(poly);

                // Premium Shading for Harmonic Patterns
                if (['xabcd', 'cypher', 'shark'].includes(d.type) && d.points.length >= 3) {
                    const pX = d.points[0], pA = d.points[1], pB = d.points[2];
                    const pxX = ts.timeToCoordinate(pX.time), pyX = ps.priceToCoordinate(pX.price);
                    const pxA = ts.timeToCoordinate(pA.time), pyA = ps.priceToCoordinate(pA.price);
                    const pxB = ts.timeToCoordinate(pB.time), pyB = ps.priceToCoordinate(pB.price);
                    if (pxX !== null && pxA !== null && pxB !== null) {
                        const shade1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                        shade1.setAttribute('points', `${pxX},${pyX} ${pxA},${pyA} ${pxB},${pyB}`);
                        shade1.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                        svg.insertBefore(shade1, poly);
                    }
                    if (d.points.length >= 5) {
                        const pC = d.points[3], pD = d.points[4];
                        const pxB = ts.timeToCoordinate(pB.time), pyB = ps.priceToCoordinate(pB.price);
                        const pxC = ts.timeToCoordinate(pC.time), pyC = ps.priceToCoordinate(pC.price);
                        const pxD = ts.timeToCoordinate(pD.time), pyD = ps.priceToCoordinate(pD.price);
                        if (pxB !== null && pxC !== null && pxD !== null) {
                            const shade2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                            shade2.setAttribute('points', `${pxB},${pyB} ${pxC},${pyC} ${pxD},${pyD}`);
                            shade2.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                            svg.insertBefore(shade2, poly);
                        }
                    }
                }

                const labels = d.type === 'abcd' ? ['A', 'B', 'C', 'D'] :
                    d.type === 'threeDrives' ? ['1', '2', '3', '4', '5', '6'] :
                        d.type === 'fiveO' ? ['0', '1', '2', '3', '4', '5'] :
                            ['X', 'A', 'B', 'C', 'D'];

                d.points.forEach((p, idx) => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    if (px !== null && py !== null) {
                        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        t.textContent = labels[idx] || '';
                        t.setAttribute('x', px);
                        t.setAttribute('y', py - 10);
                        t.setAttribute('fill', '#d1d4dc');
                        t.setAttribute('font-size', '12px');
                        t.setAttribute('font-weight', 'bold');
                        t.setAttribute('text-anchor', 'middle');
                        svg.appendChild(t);
                    }
                });
            } else if (['elliottImpulse', 'elliottCorrection', 'elliottTriangle', 'elliottDoubleCombo', 'elliottTripleCombo'].includes(d.type) && d.points.length >= 2) {
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                const pts = d.points.map(p => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    return (px !== null && py !== null) ? `${px},${py}` : '';
                }).filter(s => s).join(' ');
                poly.setAttribute('points', pts);
                poly.setAttribute('stroke', d.color || '#2962ff');
                poly.setAttribute('stroke-width', d.lineWidth || 2);
                poly.setAttribute('fill', 'none');
                poly.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(poly);

                const labels = d.type === 'elliottImpulse' ? ['(1)', '(2)', '(3)', '(4)', '(5)'] :
                    d.type === 'elliottCorrection' ? ['(A)', '(B)', '(C)'] :
                        d.type === 'elliottTriangle' ? ['(A)', '(B)', '(C)', '(D)', '(E)'] :
                            d.type === 'elliottDoubleCombo' ? ['(W)', '(X)', '(Y)'] :
                                ['(W)', '(X)', '(Y)', '(X)', '(Z)'];

                d.points.forEach((p, idx) => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    if (px !== null && py !== null) {
                        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        t.textContent = labels[idx] || '';
                        t.setAttribute('x', px);
                        t.setAttribute('y', py - 12);
                        t.setAttribute('fill', '#d1d4dc');
                        t.setAttribute('font-size', '12px');
                        t.setAttribute('font-weight', 'bold');
                        t.setAttribute('text-anchor', 'middle');
                        svg.appendChild(t);
                    }
                });
            } else if (['headAndShoulders', 'trianglePattern', 'wedgePattern', 'rectanglePattern', 'channelPattern', 'doubleTop', 'doubleBottom'].includes(d.type) && d.points.length >= 2) {
                const isPolygon = ['trianglePattern', 'rectanglePattern'].includes(d.type);
                const poly = document.createElementNS('http://www.w3.org/2000/svg', isPolygon ? 'polygon' : 'polyline');
                const pts = d.points.map(p => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    return (px !== null && py !== null) ? `${px},${py}` : '';
                }).filter(s => s).join(' ');
                poly.setAttribute('points', pts);
                poly.setAttribute('stroke', d.color || '#2962ff');
                poly.setAttribute('stroke-width', d.lineWidth || 2);
                poly.setAttribute('fill', isPolygon ? (d.fillColor || 'rgba(41, 98, 255, 0.1)') : 'none');
                poly.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(poly);

                if (d.type === 'headAndShoulders') {
                    const labels = ['S1', 'LS', 'N1', 'H', 'N2', 'RS', 'E1'];
                    d.points.forEach((p, idx) => {
                        const px = ts.timeToCoordinate(p.time);
                        const py = ps.priceToCoordinate(p.price);
                        if (px !== null && py !== null && labels[idx]) {
                            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            t.textContent = labels[idx];
                            t.setAttribute('x', px);
                            t.setAttribute('y', py - 12);
                            t.setAttribute('fill', '#d1d4dc');
                            t.setAttribute('font-size', '10px');
                            t.setAttribute('font-weight', 'bold');
                            t.setAttribute('text-anchor', 'middle');
                            svg.appendChild(t);
                        }
                    });
                }
                if (['doubleTop', 'doubleBottom'].includes(d.type)) {
                    const labels = d.type === 'doubleTop' ? ['S', 'T1', 'N', 'T2', 'E'] : ['S', 'B1', 'N', 'B2', 'E'];
                    d.points.forEach((p, idx) => {
                        const px = ts.timeToCoordinate(p.time);
                        const py = ps.priceToCoordinate(p.price);
                        if (px !== null && py !== null && labels[idx]) {
                            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            t.textContent = labels[idx];
                            t.setAttribute('x', px);
                            t.setAttribute('y', py - 12);
                            t.setAttribute('fill', '#d1d4dc');
                            t.setAttribute('font-size', '10px');
                            t.setAttribute('font-weight', 'bold');
                            t.setAttribute('text-anchor', 'middle');
                            svg.appendChild(t);
                        }
                    });
                }
            } else if (['pitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'insidePitchfork'].includes(d.type) && d.points.length >= 2) {
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2] || d.points[1];
                let px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null) {
                    // Handle Pitchfork variants
                    if (d.type === 'schiffPitchfork') {
                        // Median point between P1 and P2 for Schiff
                        py1 = (py1 + py2) / 2;
                    } else if (d.type === 'modifiedSchiffPitchfork') {
                        // Horizontal Projection
                        px1 = (px1 + px2) / 2;
                        py1 = (py1 + py2) / 2;
                    } else if (d.type === 'insidePitchfork') {
                        // Offset base
                        const midP2P3y = (py2 + py3) / 2;
                        py1 = (py1 + midP2P3y) / 2;
                    }

                    // Handle calculation
                    const midX = (px2 + px3) / 2;
                    const midY = (py2 + py3) / 2;
                    const slope = (midY - py1) / (midX - px1);
                    const intercept = py1 - slope * px1;

                    // Median Line
                    const med = line.cloneNode();
                    med.setAttribute('x1', px1); med.setAttribute('y1', py1);
                    med.setAttribute('x2', width); med.setAttribute('y2', slope * width + intercept);
                    svg.appendChild(med);

                    // Upper and Lower Lines
                    const dy = py3 - midY;
                    [dy, -dy].forEach(offset => {
                        const l = line.cloneNode();
                        l.setAttribute('x1', px2 + (offset === dy ? 0 : px3 - px2));
                        l.setAttribute('y1', py2 + (offset === dy ? 0 : py3 - py2));
                        l.setAttribute('x2', width);
                        l.setAttribute('y2', slope * width + intercept + offset);
                        svg.appendChild(l);
                    });
                }
            } else if (d.type === 'regressionChannel' && d.points.length >= 2) {
                const p1 = d.points[0], p2 = d.points[1];
                const startIdx = data.findIndex(item => item.time === p1.time);
                const endIdx = data.findIndex(item => item.time === p2.time);
                if (startIdx !== -1 && endIdx !== -1) {
                    const subset = data.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                    const n = subset.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    subset.forEach((d, i) => {
                        sumX += i; sumY += d.close; sumXY += i * d.close; sumXX += i * i;
                    });
                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    const intercept = (sumY - slope * sumX) / n;

                    const lx1 = ts.timeToCoordinate(subset[0].time);
                    const lx2 = ts.timeToCoordinate(subset[n - 1].time);
                    const ly1 = ps.priceToCoordinate(intercept);
                    const ly2 = ps.priceToCoordinate(slope * (n - 1) + intercept);

                    if (lx1 !== null && lx2 !== null && ly1 !== null && ly2 !== null) {
                        const med = line.cloneNode();
                        med.setAttribute('x1', lx1); med.setAttribute('y1', ly1);
                        med.setAttribute('x2', lx2); med.setAttribute('y2', ly2);
                        svg.appendChild(med);

                        // Deviation for channel
                        let maxDev = 0;
                        subset.forEach((d, i) => {
                            const pred = slope * i + intercept;
                            maxDev = Math.max(maxDev, Math.abs(d.close - pred));
                        });
                        const devY = Math.abs(ps.priceToCoordinate(intercept + maxDev) - ly1);

                        [devY, -devY].forEach(off => {
                            const l = line.cloneNode();
                            l.setAttribute('x1', lx1); l.setAttribute('y1', ly1 + off);
                            l.setAttribute('x2', lx2); l.setAttribute('y2', ly2 + off);
                            l.setAttribute('opacity', '0.4');
                            svg.appendChild(l);
                        });
                    }
                }
            } else if (d.type === 'trend' && x2 !== null && y2 !== null) {
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                svg.appendChild(line);
            } else if (d.type === 'arrow' && x2 !== null && y2 !== null) {
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                svg.appendChild(line);

                // Arrow head
                const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headSize = 10;
                const p1x = x2 - headSize * Math.cos(angle - Math.PI / 6);
                const p1y = y2 - headSize * Math.sin(angle - Math.PI / 6);
                const p2x = x2 - headSize * Math.cos(angle + Math.PI / 6);
                const p2y = y2 - headSize * Math.sin(angle + Math.PI / 6);
                arrowHead.setAttribute('points', `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`);
                arrowHead.setAttribute('fill', d.color || '#2962ff');
                svg.appendChild(arrowHead);
            } else if (d.type === 'ray' && x2 !== null && y2 !== null) {
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const dist = 10000;
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x1 + Math.cos(angle) * dist);
                line.setAttribute('y2', y1 + Math.sin(angle) * dist);
                svg.appendChild(line);
            } else if (d.type === 'extendedLine' && x2 !== null && y2 !== null) {
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const dist = 10000;
                line.setAttribute('x1', x1 - Math.cos(angle) * dist);
                line.setAttribute('y1', y1 - Math.sin(angle) * dist);
                line.setAttribute('x2', x1 + Math.cos(angle) * dist);
                line.setAttribute('y2', y1 + Math.sin(angle) * dist);
                svg.appendChild(line);
            } else if (d.type === 'infoLine' && x2 !== null && y2 !== null) {
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                svg.appendChild(line);

                // Info Box
                const priceDiff = d.p2.price - d.p1.price;
                const percDiff = (priceDiff / d.p1.price) * 100;
                const bars = Math.round(Math.abs(x2 - x1) / 10); // Approximation if we don't count data points exactly

                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

                text.textContent = `${priceDiff.toFixed(2)} (${percDiff.toFixed(2)}%)`;
                text.setAttribute('x', x2 + 10);
                text.setAttribute('y', y2 - 10);
                text.setAttribute('fill', '#d1d4dc');
                text.setAttribute('font-size', '12px');
                text.setAttribute('font-family', 'Inter, sans-serif');

                svg.appendChild(text);
            } else if (d.type === 'trendAngle' && x2 !== null && y2 !== null) {
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                svg.appendChild(line);

                // Horizontal reference line for angle
                const refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                refLine.setAttribute('x1', x1);
                refLine.setAttribute('y1', y1);
                refLine.setAttribute('x2', x1 + 50);
                refLine.setAttribute('y2', y1);
                refLine.setAttribute('stroke', 'rgba(209, 212, 220, 0.3)');
                refLine.setAttribute('stroke-dasharray', '4');
                svg.appendChild(refLine);

                const angleDeg = -Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = `${angleDeg.toFixed(1)}°`;
                text.setAttribute('x', x1 + 20);
                text.setAttribute('y', y1 - 5);
                text.setAttribute('fill', '#d1d4dc');
                text.setAttribute('font-size', '12px');
                svg.appendChild(text);
            } else if (d.type === 'horizontalLine') {
                line.setAttribute('x1', 0);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', width);
                line.setAttribute('y2', y1);
                svg.appendChild(line);
            } else if (d.type === 'horizontalRay') {
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', width);
                line.setAttribute('y2', y1);
                svg.appendChild(line);
            } else if (d.type === 'verticalLine') {
                line.setAttribute('x1', x1);
                line.setAttribute('y1', 0);
                line.setAttribute('x2', x1);
                line.setAttribute('y2', height);
                svg.appendChild(line);
            } else if (d.type === 'crossLine') {
                const hLine = line.cloneNode();
                hLine.setAttribute('x1', 0); hLine.setAttribute('y1', y1);
                hLine.setAttribute('x2', width); hLine.setAttribute('y2', y1);
                svg.appendChild(hLine);
                const vLine = line.cloneNode();
                vLine.setAttribute('x1', x1); vLine.setAttribute('y1', 0);
                vLine.setAttribute('x2', x1); vLine.setAttribute('y2', height);
                svg.appendChild(vLine);
            } else if (d.type === 'triangle') {
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const pointsStr = d.points.map(p => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    return (px !== null && py !== null) ? `${px},${py}` : '';
                }).filter(s => s).join(' ');

                poly.setAttribute('points', pointsStr);
                poly.setAttribute('stroke', d.color || '#2962ff');
                poly.setAttribute('stroke-width', d.lineWidth || 2);
                poly.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                svg.appendChild(poly);
            } else if (d.type === 'ellipse' && x2 !== null && y2 !== null) {
                const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                ellipse.setAttribute('cx', x1);
                ellipse.setAttribute('cy', y1);
                ellipse.setAttribute('rx', Math.abs(x2 - x1));
                ellipse.setAttribute('ry', Math.abs(y2 - y1));
                ellipse.setAttribute('stroke', d.color || '#2962ff');
                ellipse.setAttribute('stroke-width', d.lineWidth || 2);
                ellipse.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                svg.appendChild(ellipse);
            } else if (d.type === 'rectangle' && x2 !== null && y2 !== null) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const rx = Math.min(x1, x2);
                const ry = Math.min(y1, y2);
                const rw = Math.abs(x2 - x1);
                const rh = Math.abs(y2 - y1);
                rect.setAttribute('x', rx);
                rect.setAttribute('y', ry);
                rect.setAttribute('width', rw);
                rect.setAttribute('height', rh);
                rect.setAttribute('stroke', d.color || '#2962ff');
                rect.setAttribute('stroke-width', d.lineWidth || 2);
                rect.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                svg.appendChild(rect);
            } else if (d.type === 'circle' && x2 !== null && y2 !== null) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                circle.setAttribute('cx', x1);
                circle.setAttribute('cy', y1);
                circle.setAttribute('r', radius);
                circle.setAttribute('stroke', d.color || '#2962ff');
                circle.setAttribute('stroke-width', d.lineWidth || 2);
                circle.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                svg.appendChild(circle);
            } else if (d.type === 'rotatedRectangle' && d.points.length >= 2) {
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2] || d.points[1];
                const px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null) {
                    const dx = px2 - px1, dy = py2 - py1;
                    // Vector (dx, dy) is the base side. 
                    // Perpendicular vector is (-dy, dx).
                    // Project p3-p1 onto perpendicular vector to find offset.
                    const dist = ((px3 - px1) * (-dy) + (py3 - py1) * dx) / Math.sqrt(dx * dx + dy * dy) || 0;
                    const perpX = -dy / Math.sqrt(dx * dx + dy * dy) * dist;
                    const perpY = dx / Math.sqrt(dx * dx + dy * dy) * dist;

                    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    poly.setAttribute('points', `${px1},${py1} ${px2},${py2} ${px2 + perpX},${py2 + perpY} ${px1 + perpX},${py1 + perpY}`);
                    poly.setAttribute('stroke', d.color || '#2962ff');
                    poly.setAttribute('stroke-width', d.lineWidth || 2);
                    poly.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                    svg.appendChild(poly);
                }
            } else if (d.type === 'polyline' && d.points.length >= 2) {
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                const pts = d.points.map(p => {
                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    return (px !== null && py !== null) ? `${px},${py}` : '';
                }).filter(s => s).join(' ');
                poly.setAttribute('points', pts);
                poly.setAttribute('stroke', d.color || '#2962ff');
                poly.setAttribute('stroke-width', d.lineWidth || 2);
                poly.setAttribute('fill', 'none');
                svg.appendChild(poly);
            } else if (d.type === 'curve' && d.points.length >= 2) {
                // p1, p2 (control), p3
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2] || d.points[1];
                const px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);
                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', `M ${px1} ${py1} Q ${px2} ${py2} ${px3} ${py3}`);
                    path.setAttribute('stroke', d.color || '#2962ff');
                    path.setAttribute('stroke-width', d.lineWidth || 2);
                    path.setAttribute('fill', 'none');
                    svg.appendChild(path);
                }
            } else if (d.type === 'doubleCurve' && d.points.length >= 2) {
                // Cubic Bezier: p1, p2 (ctrl1), p3 (ctrl2), p4
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2] || p1, p4 = d.points[3] || p3;
                const px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);
                const px4 = ts.timeToCoordinate(p4.time), py4 = ps.priceToCoordinate(p4.price);
                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null && px4 !== null && py4 !== null) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', `M ${px1} ${py1} C ${px2} ${py2} ${px3} ${py3} ${px4} ${py4}`);
                    path.setAttribute('stroke', d.color || '#2962ff');
                    path.setAttribute('stroke-width', d.lineWidth || 2);
                    path.setAttribute('fill', 'none');
                    svg.appendChild(path);
                }
            } else if (d.type === 'longPosition' && x2 !== null && y2 !== null) {
                const stopDist = 50; // default stop loss pixels
                const targetDist = 100; // default profit target pixels

                // Profit Zone
                const profit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                profit.setAttribute('x', Math.min(x1, x2));
                profit.setAttribute('y', y1 - targetDist);
                profit.setAttribute('width', Math.abs(x2 - x1));
                profit.setAttribute('height', targetDist);
                profit.setAttribute('fill', 'rgba(8, 153, 129, 0.2)');
                svg.appendChild(profit);

                // Loss Zone
                const loss = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                loss.setAttribute('x', Math.min(x1, x2));
                loss.setAttribute('y', y1);
                loss.setAttribute('width', Math.abs(x2 - x1));
                loss.setAttribute('height', stopDist);
                loss.setAttribute('fill', 'rgba(242, 54, 69, 0.2)');
                svg.appendChild(loss);

                const centerLine = line.cloneNode();
                centerLine.setAttribute('x1', Math.min(x1, x2)); centerLine.setAttribute('x2', Math.max(x1, x2));
                centerLine.setAttribute('y1', y1); centerLine.setAttribute('y2', y1);
                svg.appendChild(centerLine);
            } else if (d.type === 'shortPosition' && x2 !== null && y2 !== null) {
                const stopDist = 50;
                const targetDist = 100;

                const loss = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                loss.setAttribute('x', Math.min(x1, x2));
                loss.setAttribute('y', y1 - stopDist);
                loss.setAttribute('width', Math.abs(x2 - x1));
                loss.setAttribute('height', stopDist);
                loss.setAttribute('fill', 'rgba(242, 54, 69, 0.2)');
                svg.appendChild(loss);

                const profit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                profit.setAttribute('x', Math.min(x1, x2));
                profit.setAttribute('y', y1);
                profit.setAttribute('width', Math.abs(x2 - x1));
                profit.setAttribute('height', targetDist);
                profit.setAttribute('fill', 'rgba(8, 153, 129, 0.2)');
                svg.appendChild(profit);

                const centerLine = line.cloneNode();
                centerLine.setAttribute('x1', Math.min(x1, x2)); centerLine.setAttribute('x2', Math.max(x1, x2));
                centerLine.setAttribute('y1', y1); centerLine.setAttribute('y2', y1);
                svg.appendChild(centerLine);
            } else if (d.type === 'priceRange' && x2 !== null && y2 !== null) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', Math.min(x1, x2)); rect.setAttribute('y', Math.min(y1, y2));
                rect.setAttribute('width', Math.abs(x2 - x1)); rect.setAttribute('height', Math.abs(y2 - y1));
                rect.setAttribute('fill', 'rgba(41, 98, 255, 0.1)');
                rect.setAttribute('stroke', d.color || '#2962ff');
                svg.appendChild(rect);

                const priceDiff = Math.abs(d.p2.price - d.p1.price);
                const percentChange = (priceDiff / d.p1.price) * 100;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = `${priceDiff.toFixed(2)} (${percentChange.toFixed(2)}%)`;
                text.setAttribute('x', x2 + 5); text.setAttribute('y', (y1 + y2) / 2);
                text.setAttribute('fill', '#d1d4dc'); text.setAttribute('font-size', '12px');
                svg.appendChild(text);
            } else if (d.type === 'dateRange' && x2 !== null && y2 !== null) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', Math.min(x1, x2)); rect.setAttribute('y', 0);
                rect.setAttribute('width', Math.abs(x2 - x1)); rect.setAttribute('height', height);
                rect.setAttribute('fill', 'rgba(41, 98, 255, 0.1)');
                svg.appendChild(rect);

                const bars = Math.abs(data.findIndex(item => item.time === d.p2.time) - data.findIndex(item => item.time === d.p1.time));
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = `${bars} bars`;
                text.setAttribute('x', (x1 + x2) / 2); text.setAttribute('y', 20);
                text.setAttribute('fill', '#d1d4dc'); text.setAttribute('font-size', '12px');
                text.setAttribute('text-anchor', 'middle');
                svg.appendChild(text);
            } else if (d.type === 'forecast' && x2 !== null && y2 !== null) {
                line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                line.setAttribute('stroke-dasharray', '4,4');
                svg.appendChild(line);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = 'Forecast';
                text.setAttribute('x', x2 + 5); text.setAttribute('y', y2 - 5);
                text.setAttribute('fill', d.color); text.setAttribute('font-size', '10px');
                svg.appendChild(text);
            } else if (d.type === 'ghostFeed' && x2 !== null && y2 !== null) {
                const ghost = line.cloneNode();
                ghost.setAttribute('x1', x1); ghost.setAttribute('y1', y1);
                ghost.setAttribute('x2', x2); ghost.setAttribute('y2', y2);
                ghost.setAttribute('stroke-dasharray', '2,4');
                ghost.setAttribute('opacity', '0.5');
                svg.appendChild(ghost);
            } else if (d.type === 'buyLabel' && x1 !== null && y1 !== null) {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x1 - 20); rect.setAttribute('y', y1 + 10);
                rect.setAttribute('width', 40); rect.setAttribute('height', 20);
                rect.setAttribute('fill', '#089981'); rect.setAttribute('rx', 4);
                g.appendChild(rect);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = 'BUY';
                text.setAttribute('x', x1); text.setAttribute('y', y1 + 24);
                text.setAttribute('fill', 'white'); text.setAttribute('font-size', '10px');
                text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-weight', 'bold');
                g.appendChild(text);
                svg.appendChild(g);
            } else if (d.type === 'sellLabel' && x1 !== null && y1 !== null) {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x1 - 22); rect.setAttribute('y', y1 - 30);
                rect.setAttribute('width', 44); rect.setAttribute('height', 20);
                rect.setAttribute('fill', '#f23645'); rect.setAttribute('rx', 4);
                g.appendChild(rect);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = 'SELL';
                text.setAttribute('x', x1); text.setAttribute('y', y1 - 16);
                text.setAttribute('fill', 'white'); text.setAttribute('font-size', '10px');
                text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-weight', 'bold');
                g.appendChild(text);
                svg.appendChild(g);
            } else if (d.type === 'arrowMark' && x1 !== null && y1 !== null) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = '➚';
                text.setAttribute('x', x1); text.setAttribute('y', y1);
                text.setAttribute('fill', d.color || '#2962ff');
                text.setAttribute('font-size', '24px');
                text.setAttribute('text-anchor', 'middle');
                svg.appendChild(text);
            } else if (d.type === 'riskReward' && x2 !== null && y2 !== null) {
                // Similar to Long Position but with different labeling
                const stopDist = 40;
                const targetDist = 80;
                const profit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                profit.setAttribute('x', Math.min(x1, x2)); profit.setAttribute('y', y1 - targetDist);
                profit.setAttribute('width', Math.abs(x2 - x1)); profit.setAttribute('height', targetDist);
                profit.setAttribute('fill', 'rgba(8, 153, 129, 0.15)');
                svg.appendChild(profit);
                const loss = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                loss.setAttribute('x', Math.min(x1, x2)); loss.setAttribute('y', y1);
                loss.setAttribute('width', Math.abs(x2 - x1)); loss.setAttribute('height', stopDist);
                loss.setAttribute('fill', 'rgba(242, 54, 69, 0.15)');
                svg.appendChild(loss);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = `R/R: ${(targetDist / stopDist).toFixed(2)}`;
                text.setAttribute('x', x2 + 5); text.setAttribute('y', y1);
                text.setAttribute('fill', '#d1d4dc'); text.setAttribute('font-size', '12px');
                svg.appendChild(text);
            } else if (d.type === 'arc' && d.points.length >= 2) {
                const p1 = d.points[0], p2 = d.points[2] || d.points[1], p3 = d.points[1];
                const px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);
                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', `M ${px1} ${py1} Q ${px3} ${py3} ${px2} ${py2}`);
                    path.setAttribute('stroke', d.color || '#2962ff');
                    path.setAttribute('stroke-width', d.lineWidth || 2);
                    path.setAttribute('fill', 'none');
                    svg.appendChild(path);
                }
            } else if (d.type === 'fibRetracement' && x2 !== null && y2 !== null) {
                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                const priceRange = d.p2.price - d.p1.price;

                levels.forEach(lvl => {
                    const price = d.p1.price + priceRange * lvl;
                    const cosY = ps.priceToCoordinate(price);
                    if (cosY !== null) {
                        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        l.setAttribute('x1', Math.min(x1, x2));
                        l.setAttribute('y1', cosY);
                        l.setAttribute('x2', Math.max(x1, x2));
                        l.setAttribute('y2', cosY);
                        l.setAttribute('stroke', d.color || '#2962ff');
                        l.setAttribute('stroke-width', 1);
                        l.setAttribute('stroke-dasharray', '2,2');
                        svg.appendChild(l);

                        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        t.textContent = `${lvl.toFixed(3)} (${price.toFixed(2)})`;
                        t.setAttribute('x', Math.max(x1, x2) + 5);
                        t.setAttribute('y', cosY + 3);
                        t.setAttribute('fill', '#d1d4dc');
                        t.setAttribute('font-size', '10px');
                        svg.appendChild(t);
                    }
                });

                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke-dasharray', '4,4');
                line.setAttribute('opacity', '0.5');
                svg.appendChild(line);
            } else if (d.type === 'fibExtension' && d.points.length >= 2) {
                const p1 = d.points[0];
                const p2 = d.points[1];
                const p3 = d.points[2] || d.points[1];

                const px1 = ts.timeToCoordinate(p1.time);
                const py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time);
                const py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time);
                const py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null) {
                    const priceDiff = p2.price - p1.price;
                    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];

                    levels.forEach(lvl => {
                        const price = p3.price + priceDiff * lvl;
                        const cosY = ps.priceToCoordinate(price);
                        if (cosY !== null) {
                            const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                            l.setAttribute('x1', px3);
                            l.setAttribute('y1', cosY);
                            l.setAttribute('x2', width);
                            l.setAttribute('y2', cosY);
                            l.setAttribute('stroke', d.color || '#2962ff');
                            l.setAttribute('stroke-width', 1);
                            l.setAttribute('opacity', '0.6');
                            svg.appendChild(l);
                        }
                    });
                }
            } else if (d.type === 'fibFan' && x2 !== null && y2 !== null) {
                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                levels.forEach(lvl => {
                    const yOffset = (y2 - y1) * lvl;
                    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    l.setAttribute('x1', x1);
                    l.setAttribute('y1', y1);
                    l.setAttribute('x2', x2);
                    l.setAttribute('y2', y1 + yOffset);
                    l.setAttribute('stroke', d.color || '#2962ff');
                    l.setAttribute('stroke-width', 1);
                    l.setAttribute('opacity', '0.5');
                    svg.appendChild(l);
                });
            } else if (d.type === 'fibTimeZone' && x2 !== null && y2 !== null) {
                const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
                const dx = Math.abs(x2 - x1);
                fib.forEach(f => {
                    const lx = x1 + f * dx;
                    if (lx < width) {
                        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        l.setAttribute('x1', lx);
                        l.setAttribute('y1', 0);
                        l.setAttribute('x2', lx);
                        l.setAttribute('y2', height);
                        l.setAttribute('stroke', d.color || '#2962ff');
                        l.setAttribute('opacity', '0.4');
                        svg.appendChild(l);
                    }
                });
            } else if (d.type === 'gannFan' && x2 !== null && y2 !== null) {
                const angles = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8];
                angles.forEach(angle => {
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    l.setAttribute('x1', x1);
                    l.setAttribute('y1', y1);
                    l.setAttribute('x2', x1 + 10000);
                    l.setAttribute('y2', y1 + (dy / dx) * angle * 10000);
                    l.setAttribute('stroke', d.color || '#2962ff');
                    l.setAttribute('stroke-width', 1);
                    l.setAttribute('opacity', '0.3');
                    svg.appendChild(l);
                });
            } else if (d.type === 'fibCircles' && x2 !== null && y2 !== null) {
                const levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
                const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                levels.forEach(lvl => {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x1);
                    circle.setAttribute('cy', y1);
                    circle.setAttribute('r', radius * lvl);
                    circle.setAttribute('stroke', d.color || '#2962ff');
                    circle.setAttribute('fill', 'none');
                    circle.setAttribute('opacity', '0.3');
                    svg.appendChild(circle);
                });
            } else if (d.type === 'fibSpeedArcs' && x2 !== null && y2 !== null) {
                const levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
                const radius = Math.abs(x2 - x1);
                levels.forEach(lvl => {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const r = radius * lvl;
                    // Arc from 0 to -90 degrees roughly
                    path.setAttribute('d', `M ${x1} ${y1 - r} A ${r} ${r} 0 0 1 ${x1 + r} ${y1}`);
                    path.setAttribute('stroke', d.color || '#2962ff');
                    path.setAttribute('fill', 'none');
                    path.setAttribute('opacity', '0.4');
                    svg.appendChild(path);
                });
            } else if (d.type === 'gannSquare' && x2 !== null && y2 !== null) {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', Math.min(x1, x2));
                rect.setAttribute('y', Math.min(y1, y2));
                rect.setAttribute('width', Math.abs(dx));
                rect.setAttribute('height', Math.abs(dy));
                rect.setAttribute('stroke', d.color || '#2962ff');
                rect.setAttribute('fill', 'none');
                svg.appendChild(rect);

                // Diagonals
                const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l1.setAttribute('x1', x1); l1.setAttribute('y1', y1); l1.setAttribute('x2', x2); l1.setAttribute('y2', y2);
                l1.setAttribute('stroke', d.color); l1.setAttribute('opacity', '0.3');
                svg.appendChild(l1);
                const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l2.setAttribute('x1', x1); l2.setAttribute('y1', y2); l2.setAttribute('x2', x2); l2.setAttribute('y2', y1);
                l2.setAttribute('stroke', d.color); l2.setAttribute('opacity', '0.3');
                svg.appendChild(l2);
            } else if (d.type === 'gannBox' && x2 !== null && y2 !== null) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', Math.min(x1, x2));
                rect.setAttribute('y', Math.min(y1, y2));
                rect.setAttribute('width', Math.abs(x2 - x1));
                rect.setAttribute('height', Math.abs(y2 - y1));
                rect.setAttribute('stroke', d.color || '#2962ff');
                rect.setAttribute('fill', 'none');
                svg.appendChild(rect);

                const levels = [0.25, 0.382, 0.5, 0.618, 0.75];
                levels.forEach(lvl => {
                    const h = line.cloneNode();
                    const hy = Math.min(y1, y2) + Math.abs(y2 - y1) * lvl;
                    h.setAttribute('x1', Math.min(x1, x2)); h.setAttribute('x2', Math.max(x1, x2));
                    h.setAttribute('y1', hy); h.setAttribute('y2', hy);
                    h.setAttribute('opacity', '0.2');
                    svg.appendChild(h);

                    const v = line.cloneNode();
                    const vx = Math.min(x1, x2) + Math.abs(x2 - x1) * lvl;
                    v.setAttribute('x1', vx); v.setAttribute('x2', vx);
                    v.setAttribute('y1', Math.min(y1, y2)); v.setAttribute('y2', Math.max(y1, y2));
                    v.setAttribute('opacity', '0.2');
                    svg.appendChild(v);
                });
            } else if (d.type === 'fibChannel' && d.points.length >= 2) {
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2] || p1;
                const px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null) {
                    const slope = (py2 - py1) / (px2 - px1);
                    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                    const offsetBase = py3 !== null ? py3 - (py1 + (px3 - px1) * slope) : 0;

                    levels.forEach(lvl => {
                        const l = line.cloneNode();
                        const currOffset = offsetBase * lvl;
                        l.setAttribute('x1', 0); l.setAttribute('x2', width);
                        l.setAttribute('y1', py1 + currOffset - px1 * slope);
                        l.setAttribute('y2', py1 + currOffset + (width - px1) * slope);
                        l.setAttribute('opacity', lvl === 0 || lvl === 1 ? '0.6' : '0.3');
                        svg.appendChild(l);
                    });
                }
            } else if (d.type === 'fibWedge' && d.points.length >= 2) {
                const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2] || p1;
                const px1 = ts.timeToCoordinate(p1.time), py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time), py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time), py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null && px3 !== null && py3 !== null) {
                    const levels = [0.382, 0.5, 0.618, 0.786, 1];
                    levels.forEach(lvl => {
                        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        const r1 = Math.sqrt(Math.pow(px2 - px1, 2) + Math.pow(py2 - py1, 2)) * lvl;
                        const r2 = Math.sqrt(Math.pow(px3 - px1, 2) + Math.pow(py3 - py1, 2)) * lvl;
                        // Simplified wedge arc
                        arc.setAttribute('d', `M ${px1} ${py1 - r1} L ${px1 + r2} ${py1}`);
                        arc.setAttribute('stroke', d.color); arc.setAttribute('fill', 'none'); arc.setAttribute('opacity', '0.3');
                        svg.appendChild(arc);
                    });
                }
            } else if (d.type === 'fibSpiral' && x2 !== null && y2 !== null) {
                const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                let pathStr = `M ${x1} ${y1}`;
                for (let a = 0; a < Math.PI * 4; a += 0.1) {
                    const r = (radius / (Math.PI * 4)) * a;
                    const sx = x1 + Math.cos(a) * r;
                    const sy = y1 + Math.sin(a) * r;
                    pathStr += ` L ${sx} ${sy}`;
                }
                const spiral = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                spiral.setAttribute('d', pathStr);
                spiral.setAttribute('stroke', d.color); spiral.setAttribute('fill', 'none'); spiral.setAttribute('opacity', '0.5');
                svg.appendChild(spiral);
            } else if (d.type === 'parallelChannel' && d.points.length >= 2) {
                const p1 = d.points[0];
                const p2 = d.points[1];
                const p3 = d.points[2] || d.points[1];

                const px1 = ts.timeToCoordinate(p1.time);
                const py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time);
                const py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time);
                const py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null) {
                    const l1 = line.cloneNode();
                    l1.setAttribute('x1', px1); l1.setAttribute('y1', py1);
                    l1.setAttribute('x2', px2); l1.setAttribute('y2', py2);
                    svg.appendChild(l1);

                    if (px3 !== null && py3 !== null) {
                        const dx = px2 - px1;
                        const dy = py2 - py1;

                        // Project p3 onto the line p1-p2 to find offset
                        // For simplicity, we just use the vertical/perpendicular offset
                        const offsetLine = line.cloneNode();
                        const dyOffset = py3 - (py1 + (px3 - px1) * (dy / dx));

                        offsetLine.setAttribute('x1', px1);
                        offsetLine.setAttribute('y1', py1 + dyOffset);
                        offsetLine.setAttribute('x2', px2);
                        offsetLine.setAttribute('y2', py2 + dyOffset);
                        svg.appendChild(offsetLine);

                        // Shaded area
                        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                        poly.setAttribute('points', `${px1},${py1} ${px2},${py2} ${px2},${py2 + dyOffset} ${px1},${py1 + dyOffset}`);
                        poly.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                        svg.appendChild(poly);
                    }
                }
            } else if (d.type === 'flatTopBottom' && d.points.length >= 2) {
                const p1 = d.points[0];
                const p2 = d.points[1];
                const p3 = d.points[2] || d.points[1];

                const px1 = ts.timeToCoordinate(p1.time);
                const py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time);
                const py2 = ps.priceToCoordinate(p2.price);
                const px3 = ts.timeToCoordinate(p3.time);
                const py3 = ps.priceToCoordinate(p3.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null) {
                    const l1 = line.cloneNode();
                    l1.setAttribute('x1', px1); l1.setAttribute('y1', py1);
                    l1.setAttribute('x2', px2); l1.setAttribute('y2', py1); // Horizontal
                    svg.appendChild(l1);

                    if (px3 !== null && py3 !== null) {
                        const l2 = line.cloneNode();
                        l2.setAttribute('x1', px1); l2.setAttribute('y1', py3);
                        l2.setAttribute('x2', px2); l2.setAttribute('y2', py3);
                        svg.appendChild(l2);

                        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                        poly.setAttribute('points', `${px1},${py1} ${px2},${py1} ${px2},${py3} ${px1},${py3}`);
                        poly.setAttribute('fill', d.fillColor || 'rgba(41, 98, 255, 0.1)');
                        svg.appendChild(poly);
                    }
                }
            } else if (d.type === 'disjointChannel' && d.points.length >= 2) {
                const p1 = d.points[0];
                const p2 = d.points[1];
                const p3 = d.points[2];
                const p4 = d.points[3] || (allDrawings.includes(previewDrawing) && d.points.length === 4 ? d.points[3] : null);

                const px1 = ts.timeToCoordinate(p1.time);
                const py1 = ps.priceToCoordinate(p1.price);
                const px2 = ts.timeToCoordinate(p2.time);
                const py2 = ps.priceToCoordinate(p2.price);

                if (px1 !== null && py1 !== null && px2 !== null && py2 !== null) {
                    const l1 = line.cloneNode();
                    l1.setAttribute('x1', px1); l1.setAttribute('y1', py1);
                    l1.setAttribute('x2', px2); l1.setAttribute('y2', py2);
                    svg.appendChild(l1);

                    const currentP3 = p3;
                    const currentP4 = p4 || (allDrawings.includes(previewDrawing) && d.points.length === 4 ? d.points[3] : null);

                    // If we have p3, we can preview l2 with mouse (which is p4 in preview points)
                    if (currentP3) {
                        const px3 = ts.timeToCoordinate(currentP3.time);
                        const py3 = ps.priceToCoordinate(currentP3.price);
                        const mousePoint = d.points[3] || d.points[d.points.length - 1]; // During preview, last point is mouse
                        const px4 = ts.timeToCoordinate(mousePoint.time);
                        const py4 = ps.priceToCoordinate(mousePoint.price);

                        if (px3 !== null && py3 !== null && px4 !== null && py4 !== null) {
                            const l2 = line.cloneNode();
                            l2.setAttribute('x1', px3); l2.setAttribute('y1', py3);
                            l2.setAttribute('x2', px4); l2.setAttribute('y2', py4);
                            svg.appendChild(l2);
                        }
                    }
                }
            } else if (d.type === 'regressionTrend' && x2 !== null && y2 !== null) {
                // Optimized Regression: Find indices instead of filtering every frame
                const t1 = Math.min(d.p1.time, d.p2.time);
                const t2 = Math.max(d.p1.time, d.p2.time);

                // Assuming data is sorted by time (standard for candle data)
                let startIdx = -1, endIdx = -1;
                for (let i = 0; i < data.length; i++) {
                    if (startIdx === -1 && data[i].time >= t1) startIdx = i;
                    if (data[i].time <= t2) endIdx = i;
                    if (data[i].time > t2) break;
                }

                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                    const n = endIdx - startIdx + 1;
                    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
                    for (let i = startIdx; i <= endIdx; i++) {
                        const x = i - startIdx;
                        const y = data[i].close;
                        sumX += x;
                        sumY += y;
                        sumXY += x * y;
                        sumX2 += x * x;
                    }
                    const denominator = (n * sumX2 - sumX * sumX);
                    if (denominator !== 0) {
                        const slope = (n * sumXY - sumX * sumY) / denominator;
                        const intercept = (sumY - slope * sumX) / n;

                        const startPrice = intercept;
                        const endPrice = intercept + slope * (n - 1);

                        const ry1 = ps.priceToCoordinate(startPrice);
                        const ry2 = ps.priceToCoordinate(endPrice);

                        if (ry1 !== null && ry2 !== null) {
                            line.setAttribute('x1', x1);
                            line.setAttribute('y1', ry1);
                            line.setAttribute('x2', x2);
                            line.setAttribute('y2', ry2);
                            svg.appendChild(line);

                            // Standard Error Bands
                            let sumSqErrors = 0;
                            for (let i = startIdx; i <= endIdx; i++) {
                                const pred = intercept + slope * (i - startIdx);
                                sumSqErrors += Math.pow(data[i].close - pred, 2);
                            }
                            const stdev = Math.sqrt(sumSqErrors / n);
                            const bandOffset = Math.abs(ps.priceToCoordinate(startPrice + stdev) - ry1);

                            [1, -1].forEach(dir => {
                                const band = line.cloneNode();
                                band.setAttribute('x1', x1);
                                band.setAttribute('y1', ry1 + dir * bandOffset);
                                band.setAttribute('x2', x2);
                                band.setAttribute('y2', ry2 + dir * bandOffset);
                                band.setAttribute('opacity', '0.4');
                                band.setAttribute('stroke-dasharray', '2,2');
                                svg.appendChild(band);
                            });
                        }
                    }
                } else {
                    line.setAttribute('x1', x1);
                    line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2);
                    line.setAttribute('y2', y2);
                    svg.appendChild(line);
                }
            } else {
                return;
            }

            // Add anchor points
            const isPreview = allDrawings.includes(previewDrawing);
            if (!isPreview || d.points.length > 1) {
                d.points.forEach((p, idx) => {
                    // During preview, don't draw the last point (it's the moving mouse) as a fixed anchor
                    if (isPreview && idx === d.points.length - 1) return;

                    const px = ts.timeToCoordinate(p.time);
                    const py = ps.priceToCoordinate(p.price);
                    if (px !== null && py !== null) {
                        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        circle.setAttribute('cx', px);
                        circle.setAttribute('cy', py);
                        circle.setAttribute('r', 4);
                        circle.setAttribute('fill', '#131722');
                        circle.setAttribute('stroke', d.color || '#2962ff');
                        circle.setAttribute('stroke-width', 2);
                        svg.appendChild(circle);
                    }
                });
            }
        });
    }, [drawings, previewDrawing, data, chartTick]);

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
        const hasStoch = indicators.some(i => i.type === 'stoch' && i.visible);
        const hasAtr = indicators.some(i => i.type === 'atr' && i.visible);

        const activePanes = [];
        if (hasRsi) activePanes.push('rsi');
        if (hasStoch) activePanes.push('stoch');
        if (hasMacd) activePanes.push('macd');
        if (hasAtr) activePanes.push('atr');

        const oscillatorCount = activePanes.length;

        // Layout margins
        let priceBottom = 0.08;
        let volTop = 0.82, volBottom = 0;

        const marginsMap = {
            rsi: { top: 0.80, bottom: 0.02 },
            macd: { top: 0.80, bottom: 0.02 },
            stoch: { top: 0.80, bottom: 0.02 },
            atr: { top: 0.80, bottom: 0.02 },
            tsi: { top: 0.80, bottom: 0.02 }
        };

        if (oscillatorCount === 1) {
            priceBottom = 0.40;
            volTop = 0.65; volBottom = 0.25;
            marginsMap[activePanes[0]] = { top: 0.80, bottom: 0.02 };
        } else if (oscillatorCount === 2) {
            priceBottom = 0.55;
            volTop = 0.48; volBottom = 0.40;
            marginsMap[activePanes[0]] = { top: 0.62, bottom: 0.20 };
            marginsMap[activePanes[1]] = { top: 0.82, bottom: 0.02 };
        } else if (oscillatorCount === 3) {
            priceBottom = 0.65;
            volTop = 0.36; volBottom = 0.60;
            marginsMap[activePanes[0]] = { top: 0.42, bottom: 0.40 };
            marginsMap[activePanes[1]] = { top: 0.62, bottom: 0.20 };
            marginsMap[activePanes[2]] = { top: 0.82, bottom: 0.02 };
        } else if (oscillatorCount === 4) {
            priceBottom = 0.72;
            volTop = 0.30; volBottom = 0.65;
            marginsMap[activePanes[0]] = { top: 0.36, bottom: 0.48 };
            marginsMap[activePanes[1]] = { top: 0.52, bottom: 0.32 };
            marginsMap[activePanes[2]] = { top: 0.68, bottom: 0.16 };
            marginsMap[activePanes[3]] = { top: 0.84, bottom: 0.02 };
        } else if (oscillatorCount === 5) {
            priceBottom = 0.78;
            volTop = 0.25; volBottom = 0.70;
            marginsMap[activePanes[0]] = { top: 0.35, bottom: 0.52 };
            marginsMap[activePanes[1]] = { top: 0.48, bottom: 0.39 };
            marginsMap[activePanes[2]] = { top: 0.61, bottom: 0.26 };
            marginsMap[activePanes[3]] = { top: 0.74, bottom: 0.13 };
            marginsMap[activePanes[4]] = { top: 0.87, bottom: 0.01 };
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

            // Perfect drawing sync: Attach primitive once per series creation
            const syncProp = new SyncPrimitive(() => {
                setChartTick(t => t + 1);
            });
            priceSeriesRef.current.attachPrimitive(syncProp);
        }

        const priceData = chartType === 'heikin' ? computeHeikinAshi(data) : (chartType === 'line' ? data.map(d => ({ time: d.time, value: d.close })) : data);
        priceSeriesRef.current.setData(priceData);

        // Indicator Management
        const visibleIds = new Set(indicators.filter(ind => ind.visible).map(ind => ind.id));
        [smaSeriesRef, rsiSeriesRef, macdSeriesRef, bbSeriesRef, stochSeriesRef, supertrendSeriesRef, atrSeriesRef, ichimokuSeriesRef, tsiSeriesRef].forEach(ref => {
            Object.keys(ref.current).forEach(id => {
                if (!visibleIds.has(id)) {
                    try {
                        if (Array.isArray(ref.current[id])) ref.current[id].forEach(s => chartRef.current.removeSeries(s));
                        else chartRef.current.removeSeries(ref.current[id]);
                    } catch (_) { }
                    delete ref.current[id];
                }
            });
        });

        let vpActive = false;
        let bbActive = false;
        let ichimokuActive = false;
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
                chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: marginsMap.rsi });
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
                chartRef.current.priceScale('macd').applyOptions({ scaleMargins: marginsMap.macd });
                const [m, s, h, b0] = existing;
                const times = data.map(d => ({ time: d.time }));
                b0.setData(times.map(t => ({ ...t, value: 0 })));
                m.setData(res.macd); s.setData(res.signal); h.setData(res.histogram);
            }
            if (ind.type === 'volume_profile' && ind.visible) {
                setVpBins(computeVolumeProfile(data, ind));
                vpActive = true;
            }
            if (ind.type === 'bb' && ind.visible) {
                let existing = bbSeriesRef.current[ind.id];
                const res = computeBollingerBands(data, ind);
                if (!existing) {
                    const opts = { lineWidth: 1.2, crosshairMarkerVisible: false, lastValueVisible: ind.showPriceLabels };
                    existing = [
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.basisColor }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.upperColor, lineWidth: 1 }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.lowerColor, lineWidth: 1 })
                    ];
                    bbSeriesRef.current[ind.id] = existing;
                }
                const [basis, upper, lower] = existing;

                // Update visibility of labels dynamically
                basis.applyOptions({ lastValueVisible: ind.showPriceLabels });
                upper.applyOptions({ lastValueVisible: ind.showPriceLabels });
                lower.applyOptions({ lastValueVisible: ind.showPriceLabels });

                basis.setData(res.basis);
                upper.setData(res.upper);
                lower.setData(res.lower);
                setBbFillData({ upper: res.upper, lower: res.lower });
                bbActive = true;
            }
            if (ind.type === 'stoch' && ind.visible) {
                let existing = stochSeriesRef.current[ind.id];
                const res = computeStochastic(data, ind);
                if (!existing) {
                    const opts = { priceScaleId: 'stoch', lineWidth: 1.5, crosshairMarkerVisible: false };
                    existing = [
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.kColor || '#2962ff' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.dColor || '#ff9800' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.1)', lineStyle: 2 }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.1)', lineStyle: 2 })
                    ];
                    stochSeriesRef.current[ind.id] = existing;
                }
                chartRef.current.priceScale('stoch').applyOptions({ scaleMargins: marginsMap.stoch });
                const [k, d, upper, lower] = existing;
                const times = data.map(d => ({ time: d.time }));
                upper.setData(times.map(t => ({ ...t, value: ind.upperLine || 80 })));
                lower.setData(times.map(t => ({ ...t, value: ind.lowerLine || 20 })));
                k.setData(res.k);
                d.setData(res.d);
            }
            if (ind.type === 'supertrend' && ind.visible) {
                let existing = supertrendSeriesRef.current[ind.id];
                const res = computeSuperTrend(data, ind);
                if (!existing) {
                    const upS = chartRef.current.addSeries(LineSeries, {
                        lineWidth: 2,
                        color: ind.upColor || '#26a69a',
                        crosshairMarkerVisible: false,
                        lastValueVisible: false,
                        priceLineVisible: false,
                    });
                    const downS = chartRef.current.addSeries(LineSeries, {
                        lineWidth: 2,
                        color: ind.downColor || '#ef5350',
                        crosshairMarkerVisible: false,
                        lastValueVisible: false,
                        priceLineVisible: false,
                    });
                    existing = [upS, downS];
                    supertrendSeriesRef.current[ind.id] = existing;
                }

                const [upSeries, downSeries] = existing;
                upSeries.applyOptions({ color: ind.upColor });
                downSeries.applyOptions({ color: ind.downColor });

                const upData = res.map(d => ({
                    time: d.time,
                    value: d.trend === 1 ? d.value : null
                })).filter(d => d.value !== null);

                const downData = res.map(d => ({
                    time: d.time,
                    value: d.trend === -1 ? d.value : null
                })).filter(d => d.value !== null);

                upSeries.setData(upData);
                downSeries.setData(downData);
            }
            if (ind.type === 'atr' && ind.visible) {
                let existing = atrSeriesRef.current[ind.id];
                const res = computeATR(data, ind);
                if (!existing) {
                    existing = chartRef.current.addSeries(LineSeries, {
                        priceScaleId: 'atr',
                        color: ind.color || '#ff5252',
                        lineWidth: 1.5,
                        crosshairMarkerVisible: false,
                    });
                    atrSeriesRef.current[ind.id] = existing;
                }
                chartRef.current.priceScale('atr').applyOptions({ scaleMargins: marginsMap.atr });
                existing.applyOptions({ color: ind.color });
                existing.setData(res);
            }
            if (ind.type === 'tsi' && ind.visible) {
                let existing = tsiSeriesRef.current[ind.id];
                const res = computeTSI(data, ind);
                if (!existing) {
                    const opts = { priceScaleId: 'tsi', lineWidth: 1.5, crosshairMarkerVisible: false };
                    existing = [
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.color || '#2962ff' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.signalColor || '#ff9800', lineWidth: 1.2 }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.1)' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.05)', lineStyle: 2 }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(255,255,255,0.05)', lineStyle: 2 })
                    ];
                    tsiSeriesRef.current[ind.id] = existing;
                }
                chartRef.current.priceScale('tsi').applyOptions({ scaleMargins: marginsMap.tsi });
                const [tsi, sig, b0, b25, bN25] = existing;
                const times = data.map(d => ({ time: d.time }));
                b0.setData(times.map(t => ({ ...t, value: 0 })));
                b25.setData(times.map(t => ({ ...t, value: 25 })));
                bN25.setData(times.map(t => ({ ...t, value: -25 })));
                tsi.setData(res.tsi);
                sig.setData(res.signal);
            }
            if (ind.type === 'ichimoku' && ind.visible) {
                let existing = ichimokuSeriesRef.current[ind.id];
                const res = computeIchimoku(data, ind);
                if (!existing) {
                    const opts = { lineWidth: 1, crosshairMarkerVisible: false };
                    existing = [
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.tenkanColor, title: 'Tenkan' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.kijunColor, title: 'Kijun' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(38,166,154,0.5)', title: 'Span A' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: 'rgba(239,83,80,0.5)', title: 'Span B' }),
                        chartRef.current.addSeries(LineSeries, { ...opts, color: ind.chikouColor, title: 'Chikou' })
                    ];
                    ichimokuSeriesRef.current[ind.id] = existing;
                }
                const [t, k, sa, sb, c] = existing;
                t.setData(res.tenkan); k.setData(res.kijun); sa.setData(res.spanA); sb.setData(res.spanB); c.setData(res.chikou);
                setIchimokuFillData({ spanA: res.spanA, spanB: res.spanB });
                ichimokuActive = true;
            }
        });
        if (!vpActive) setVpBins([]);
        if (!bbActive) setBbFillData(null);
        if (!ichimokuActive) setIchimokuFillData(null);

        if (isFirstLoad.current && data.length > 0) {
            const timeScale = chartRef.current.timeScale();
            timeScale.fitContent();
            const lr = timeScale.getVisibleLogicalRange();
            if (lr) timeScale.setVisibleLogicalRange({ from: lr.from, to: lr.to + 20 });
            isFirstLoad.current = false;
        }
    }, [data, chartType, indicators, symbol, interval]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }} className={activeTool !== 'cursor' ? 'drawing-active' : ''}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            {/* Overlay SVGs for Background Shades and Volume Profiles */}
            <svg ref={bbFillRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.8 }} />
            <svg ref={ichimokuFillRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.8 }} />
            <svg ref={vpRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
            <svg ref={drawingRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }} />
        </div>
    );
};

export default Chart;
