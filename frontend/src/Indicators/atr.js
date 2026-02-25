/**
 * Average True Range (ATR) Indicator
 * Implements the Wilder's Smoothing method (Exact TradingView Logic).
 */

function isValid(val) {
    return typeof val === 'number' && isFinite(val) && val !== null;
}

/**
 * Compute ATR using Wilder's Smoothing.
 *
 * @param {Array} data - Array of OHLCV objects
 * @param {Object} settings - Indicator settings: { length }
 * @returns {Array} - Array of { time, value }
 */
export function computeATR(data, settings) {
    const { length = 14 } = settings;
    if (!data || data.length < length) return [];

    const n = data.length;
    const tr = new Array(n).fill(null);
    const atr = new Array(n).fill(null);
    const results = [];

    // 1. Calculate True Range (TR)
    for (let i = 0; i < n; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = i > 0 ? data[i - 1].close : data[0].close; // Use first close for first bar if needed

        if (!isValid(high) || !isValid(low) || !isValid(data[i].close)) continue;

        tr[i] = Math.max(
            high - low,
            Math.abs(high - (i > 0 ? data[i - 1].close : high)),
            Math.abs(low - (i > 0 ? data[i - 1].close : low))
        );
    }

    // 2. Calculate initial ATR (SMA of first 'length' TR values)
    let sum = 0;
    let initialCount = 0;
    for (let i = 0; i < n && initialCount < length; i++) {
        if (tr[i] !== null) {
            sum += tr[i];
            initialCount++;
            if (initialCount === length) {
                atr[i] = sum / length;
                results.push({ time: data[i].time, value: atr[i] });
            }
        }
    }

    // 3. Wilder's Smoothing recursive formula
    // atr[i] = (atr[i-1] * (length - 1) + tr[i]) / length
    let lastAtrIdx = -1;
    for (let i = 0; i < n; i++) {
        if (atr[i] !== null) {
            lastAtrIdx = i;
            break;
        }
    }

    if (lastAtrIdx !== -1) {
        for (let i = lastAtrIdx + 1; i < n; i++) {
            if (tr[i] !== null && atr[i - 1] !== null) {
                atr[i] = (atr[i - 1] * (length - 1) + tr[i]) / length;
                results.push({ time: data[i].time, value: atr[i] });
            }
        }
    }

    return results;
}
