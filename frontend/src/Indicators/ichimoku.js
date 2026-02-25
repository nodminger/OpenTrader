/**
 * Ichimoku Cloud Indicator Logic
 * Ported from the provided Python implementation.
 */

function isValid(val) {
    return typeof val === 'number' && isFinite(val) && val !== null;
}

function getRollingHL2(data, length, index) {
    if (index < length - 1) return null;
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < length; i++) {
        const val = data[index - i];
        if (val.high > max) max = val.high;
        if (val.low < min) min = val.low;
    }
    return (max + min) / 2;
}

/**
 * Compute Ichimoku Cloud components.
 * 
 * @param {Array} data - Array of OHLCV objects
 * @param {Object} settings - Indicator settings
 * @returns {Object} - Arrays for each line
 */
export function computeIchimoku(data, settings) {
    const {
        conversionLength = 9,
        baseLength = 26,
        spanBLength = 52,
        laggingLength = 26
    } = settings;

    const n = data.length;
    const conversionLine = new Array(n).fill(null);
    const baseLine = new Array(n).fill(null);
    const leadingSpanA = new Array(n).fill(null);
    const leadingSpanB = new Array(n).fill(null);
    const laggingSpan = new Array(n).fill(null);

    // 1. Calculate Tenkan (Conversion) and Kijun (Base)
    for (let i = 0; i < n; i++) {
        conversionLine[i] = getRollingHL2(data, conversionLength, i);
        baseLine[i] = getRollingHL2(data, baseLength, i);
    }

    // 2. Calculate Spans (shifted forward by baseLength)
    // Python shift(26) means value at index i is moved to i + 26
    // Or at index i, we take value from i - 26.
    for (let i = 0; i < n; i++) {
        // Leading Span A
        if (i >= baseLength) {
            const prevConv = conversionLine[i - baseLength];
            const prevBase = baseLine[i - baseLength];
            if (prevConv !== null && prevBase !== null) {
                leadingSpanA[i] = (prevConv + prevBase) / 2;
            }
        }

        // Leading Span B
        if (i >= baseLength) {
            const val = getRollingHL2(data, spanBLength, i - baseLength);
            if (val !== null) {
                leadingSpanB[i] = val;
            }
        }
    }

    // 3. Calculate Lagging Span (shifted backward)
    // Python shift(-26) means value at index i is moved to i - 26
    // Or at index i, we take value from i + 26 (future).
    // In charting, the Lagging point for "Today" is plotted at index (Today - 26).
    // So for index i, the value is close[i + 26].
    for (let i = 0; i < n - laggingLength; i++) {
        laggingSpan[i] = data[i + laggingLength].close;
    }

    // Formatting results for chart
    const format = (arr) => arr.map((v, i) => v !== null ? { time: data[i].time, value: v } : null).filter(v => v !== null);

    return {
        tenkan: format(conversionLine),
        kijun: format(baseLine),
        spanA: format(leadingSpanA),
        spanB: format(leadingSpanB),
        chikou: format(laggingSpan)
    };
}
