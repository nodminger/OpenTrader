/**
 * Normalized MACD Indicator Logic
 * Ported from the provided Python implementation
 * Range: -1 to +1
 */

/**
 * Exponential Moving Average
 */
function computeEMA(data, length) {
    if (data.length === 0) return [];
    const ema = [];
    const k = 2 / (length + 1);
    let prevEma = data[0];

    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (i === 0) {
            ema.push(val);
        } else {
            const currentEma = (val - prevEma) * k + prevEma;
            ema.push(currentEma);
            prevEma = currentEma;
        }
    }
    return ema;
}

/**
 * Normalized MACD Calculation
 */
export function computeMACD(data, settings) {
    const { fastLength, slowLength, signalLength, normLookback } = settings;
    const prices = data.map(d => d.close);

    if (prices.length < Math.max(fastLength, slowLength, normLookback)) {
        return { macd: [], signal: [], histogram: [] };
    }

    const emaFast = computeEMA(prices, fastLength);
    const emaSlow = computeEMA(prices, slowLength);

    const macdRaw = emaFast.map((f, i) => f - emaSlow[i]);
    const signalRaw = computeEMA(macdRaw, signalLength);

    const macdNorm = [];
    const signalNorm = [];
    const histogramNorm = [];

    for (let i = 0; i < data.length; i++) {
        if (i < normLookback - 1) {
            macdNorm.push({ time: data[i].time, value: null });
            signalNorm.push({ time: data[i].time, value: null });
            histogramNorm.push({ time: data[i].time, value: 0, color: 'rgba(120, 123, 134, 0.3)' });
            continue;
        }

        const windowMacd = macdRaw.slice(i - normLookback + 1, i + 1);
        const minMacd = Math.min(...windowMacd);
        const maxMacd = Math.max(...windowMacd);

        const windowSig = signalRaw.slice(i - normLookback + 1, i + 1);
        const minSig = Math.min(...windowSig);
        const maxSig = Math.max(...windowSig);

        let mNorm = 0;
        if (maxMacd !== minMacd) {
            mNorm = 2 * (macdRaw[i] - minMacd) / (maxMacd - minMacd) - 1;
        }

        let sNorm = 0;
        if (maxSig !== minSig) {
            sNorm = 2 * (signalRaw[i] - minSig) / (maxSig - minSig) - 1;
        }

        const hNorm = mNorm - sNorm;
        const time = data[i].time;

        macdNorm.push({ time, value: mNorm });
        signalNorm.push({ time, value: sNorm });

        // Dynamic histogram coloring
        const hColor = hNorm >= 0
            ? (hNorm > (macdNorm[i - 1]?.value - signalNorm[i - 1]?.value || 0) ? '#26a69a' : 'rgba(38, 166, 154, 0.5)')
            : (hNorm < (macdNorm[i - 1]?.value - signalNorm[i - 1]?.value || 0) ? '#ef5350' : 'rgba(239, 83, 80, 0.5)');

        histogramNorm.push({ time, value: hNorm, color: hColor });
    }

    return {
        macd: macdNorm.filter(d => d.value !== null),
        signal: signalNorm.filter(d => d.value !== null),
        histogram: histogramNorm
    };
}
