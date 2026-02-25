/**
 * True Strength Index (TSI) Logic
 * Optimized for accuracy matching TradingView's Pine Script implementation.
 * Uses double EMA smoothing of price momentum.
 */

/**
 * Calculates EMA recursively, seeding with the first non-null value.
 * Matches the behavior of Pine Script's ta.ema().
 */
function calculateEMA(data, length) {
    if (!data || data.length === 0) return new Array(0);

    const alpha = 2 / (length + 1);
    const ema = new Array(data.length).fill(null);

    let firstValidIdx = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] !== null && !isNaN(data[i])) {
            firstValidIdx = i;
            break;
        }
    }

    if (firstValidIdx === -1) return ema;

    let prevEma = data[firstValidIdx];
    ema[firstValidIdx] = prevEma;

    for (let i = firstValidIdx + 1; i < data.length; i++) {
        if (data[i] !== null && !isNaN(data[i])) {
            // Pine Script EMA formula: alpha * src + (1 - alpha) * prev_ema
            const currentEma = alpha * data[i] + (1 - alpha) * prevEma;
            ema[i] = currentEma;
            prevEma = currentEma;
        } else {
            // If data is null, the whole EMA chain becomes null in a strict implementation,
            // but in charting we usually skip or propagate. 
            // The provided python code would result in NaNs.
            ema[i] = null;
            // Stop propagation if we encounter a true gap to match strict behavior
            // prevEma = NaN; 
        }
    }
    return ema;
}

/**
 * Compute TSI.
 *
 * @param {Array} data - Array of OHLCV objects
 * @param {Object} settings - { longLength, shortLength, signalLength }
 * @returns {Object} - { tsi: Array, signal: Array }
 */
export function computeTSI(data, settings) {
    const {
        longLength = 25,
        shortLength = 13,
        signalLength = 13
    } = settings;

    if (!data || data.length < 2) return { tsi: [], signal: [] };

    const n = data.length;
    const pc = new Array(n).fill(null);
    const absPc = new Array(n).fill(null);

    // 1. Price Change (Momentum)
    for (let i = 1; i < n; i++) {
        const diff = data[i].close - data[i - 1].close;
        pc[i] = diff;
        absPc[i] = Math.abs(diff);
    }

    // 2. Double smoothing of momentum
    const ema1 = calculateEMA(pc, longLength);
    const ema2 = calculateEMA(ema1, shortLength);

    // 3. Double smoothing of absolute momentum
    const absEma1 = calculateEMA(absPc, longLength);
    const absEma2 = calculateEMA(absEma1, shortLength);

    // 4. TSI calculation
    const tsiValues = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
        // Only calculate if both double-smoothed EMAs are valid and absEma2 is not zero
        if (ema2[i] !== null && absEma2[i] !== null && absEma2[i] !== 0) {
            tsiValues[i] = 100 * (ema2[i] / absEma2[i]);
        }
    }

    // 5. Signal Line
    const signalValues = calculateEMA(tsiValues, signalLength);

    // 6. Format for Charting (optional: could apply a warmup offset here)
    // To match the python "accurate" plot, one might skip the first (long+short+signal) bars
    // but we generally let the chart display the full history once converged.
    const warmup = longLength + shortLength + signalLength; // Threshold for first stable-ish value

    const format = (arr) => arr.map((v, i) => {
        if (v === null || i < warmup) return null;
        return { time: data[i].time, value: v };
    }).filter(v => v !== null);

    return {
        tsi: format(tsiValues),
        signal: format(signalValues)
    };
}
