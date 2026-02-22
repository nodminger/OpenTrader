/**
 * RSI Indicator Logic (Wilder's Smoothing)
 * Ported from the provided Python implementation
 */

import { SMA_SOURCES } from './sma';

/**
 * Helper to ensure we are working with finite numbers
 */
function isValid(val) {
    return typeof val === 'number' && isFinite(val);
}

/**
 * Computes source value for a single candle
 */
function getSourceValue(d, source, index, data, length) {
    if (!d) return null;

    switch (source) {
        case 'open': return isValid(d.open) ? d.open : null;
        case 'close': return isValid(d.close) ? d.close : null;
        case 'high': return isValid(d.high) ? d.high : null;
        case 'low': return isValid(d.low) ? d.low : null;
        case 'hl2': {
            if (!isValid(d.high) || !isValid(d.low)) return null;
            return (d.high + d.low) / 2;
        }
        case 'hlc3': {
            if (!isValid(d.high) || !isValid(d.low) || !isValid(d.close)) return null;
            return (d.high + d.low + d.close) / 3;
        }
        case 'ohlc4': {
            if (!isValid(d.open) || !isValid(d.high) || !isValid(d.low) || !isValid(d.close)) return null;
            return (d.open + d.high + d.low + d.close) / 4;
        }
        case 'hlcc4': {
            if (!isValid(d.high) || !isValid(d.low) || !isValid(d.close)) return null;
            return (d.high + d.low + d.close * 2) / 4;
        }
        case 'volume': return isValid(d.volume) ? d.volume : null;
        case 'volume_ma': {
            if (index < length - 1) return null;
            let sum = 0;
            let count = 0;
            for (let i = 0; i < length; i++) {
                const vol = data[index - i]?.volume;
                if (isValid(vol)) {
                    sum += vol;
                    count++;
                }
            }
            return count === length ? sum / length : null;
        }
        default: return isValid(d.close) ? d.close : null;
    }
}

/**
 * Computes RSI for a whole dataset
 */
export function computeRSI(data, options) {
    const { length, source, smoothingType, smoothingLength, bbStdDev = 2 } = options;
    if (!data || data.length < length) return { rsi: [], smoothed: [], bbUpper: [], bbLower: [] };

    // 1. Extract source values
    const sourceValues = data.map((d, i) => getSourceValue(d, source, i, data, length));

    // 2. Calculate Gains and Losses
    const gains = [0];
    const losses = [0];
    for (let i = 1; i < sourceValues.length; i++) {
        const prev = sourceValues[i - 1];
        const curr = sourceValues[i];
        if (prev === null || curr === null) {
            gains.push(0);
            losses.push(0);
            continue;
        }
        const delta = curr - prev;
        gains.push(Math.max(0, delta));
        losses.push(Math.max(0, -delta));
    }

    // 3. Wilder's Moving Average for Gains and Losses
    // avg_gain = gain.ewm(alpha=1/length, adjust=False).mean()
    const rsiValues = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < data.length; i++) {
        const gain = gains[i];
        const loss = losses[i];

        if (i < length) {
            avgGain += gain;
            avgLoss += loss;
            if (i === length - 1) {
                avgGain /= length;
                avgLoss /= length;
            } else {
                rsiValues.push({ time: data[i].time, value: null });
                continue;
            }
        } else {
            // Wilder's: NewAvg = (OldAvg * (L-1) + NewVal) / L
            avgGain = (avgGain * (length - 1) + gain) / length;
            avgLoss = (avgLoss * (length - 1) + loss) / length;
        }

        let rsi = 100;
        if (avgLoss !== 0) {
            const rs = avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
        } else if (avgGain === 0) {
            rsi = 50;
        }

        rsiValues.push({ time: data[i].time, value: rsi });
    }

    // 4. Optional Smoothing (SMA)
    let smoothedValues = [];
    if (smoothingType === 'SMA' && rsiValues.length >= smoothingLength) {
        for (let i = 0; i < rsiValues.length; i++) {
            if (i < smoothingLength - 1) {
                smoothedValues.push({ time: rsiValues[i].time, value: null });
                continue;
            }
            let sum = 0;
            let count = 0;
            for (let j = 0; j < smoothingLength; j++) {
                const val = rsiValues[i - j].value;
                if (isValid(val)) {
                    sum += val;
                    count++;
                }
            }
            smoothedValues.push({
                time: rsiValues[i].time,
                value: count === smoothingLength ? sum / smoothingLength : null
            });
        }
    }

    // 5. Optional Bollinger Bands (on Smoothed RSI)
    let bbUpper = [];
    let bbLower = [];
    if (smoothingType === 'SMA' && smoothedValues.length >= smoothingLength) {
        for (let i = 0; i < smoothedValues.length; i++) {
            if (i < smoothingLength - 1) {
                bbUpper.push({ time: smoothedValues[i].time, value: null });
                bbLower.push({ time: smoothedValues[i].time, value: null });
                continue;
            }

            let sum = 0;
            let sumSq = 0;
            let count = 0;
            for (let j = 0; j < smoothingLength; j++) {
                const val = smoothedValues[i - j].value;
                if (isValid(val)) {
                    sum += val;
                    sumSq += val * val;
                    count++;
                }
            }

            if (count === smoothingLength) {
                const mean = sum / count;
                const variance = (sumSq / count) - (mean * mean);
                const stdDev = Math.sqrt(Math.max(0, variance));
                bbUpper.push({ time: smoothedValues[i].time, value: mean + bbStdDev * stdDev });
                bbLower.push({ time: smoothedValues[i].time, value: mean - bbStdDev * stdDev });
            } else {
                bbUpper.push({ time: smoothedValues[i].time, value: null });
                bbLower.push({ time: smoothedValues[i].time, value: null });
            }
        }
    }

    // Filter nulls for lightweight-charts
    const filterNulls = (arr) => arr.filter(v => v.value !== null);

    return {
        rsi: filterNulls(rsiValues),
        smoothed: filterNulls(smoothedValues),
        bbUpper: filterNulls(bbUpper),
        bbLower: filterNulls(bbLower)
    };
}
