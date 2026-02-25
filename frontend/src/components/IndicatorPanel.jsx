import React, { useState } from 'react';
import { SMA_SOURCES } from '../Indicators/sma';

/**
 * A standalone component for an indicator group (e.g. SMA or RSI)
 */
const IndicatorGroupPanel = ({
    title,
    groupType,
    indicators,
    updateIndicator,
    removeIndicator,
    removeIndicatorGroup,
    toggleIndicator
}) => {
    const [isMinimized, setIsMinimized] = useState(false);

    if (!indicators || indicators.length === 0) return null;

    if (isMinimized) {
        return (
            <div
                className={`indicator-panel minimized ${['rsi', 'macd', 'volume_profile'].includes(groupType) ? 'has-oscillator' : ''}`}
                onClick={() => setIsMinimized(false)}
                title={`Expand ${title} settings`}
            >
                <div className="minimized-header">
                    <span>
                        {groupType === 'rsi' ? '📊 RSI' :
                            groupType === 'macd' ? '📊 MACD' :
                                groupType === 'bb' ? '📊 BB' :
                                    groupType === 'stoch' ? '📊 STOCH' :
                                        groupType === 'supertrend' ? '📊 SUPERTREND' :
                                            groupType === 'atr' ? '📊 ATR' :
                                                groupType === 'ichimoku' ? '📊 ICHIMOKU' :
                                                    groupType === 'tsi' ? '📊 TSI' :
                                                        groupType === 'volume_profile' ? '📊 VP' : '📈 SMA'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="indicator-panel">
            {/* Header for this specific group */}
            <div className="indicator-panel-header">
                <span className="panel-title">{title}</span>
                <div className="panel-controls">
                    <button
                        className="header-action-btn minimize"
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                        title="Minimize"
                    >
                        −
                    </button>
                    <button
                        className="header-action-btn remove"
                        title={`Remove all ${title}`}
                        onClick={() => removeIndicatorGroup(groupType)}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="indicator-panel-content">
                {indicators.map((ind, idx) => (
                    <div key={ind.id} className={`indicator-row ${!ind.visible ? 'row-hidden' : ''}`}>
                        {/* Main Controls */}
                        <div className="indicator-row-main">
                            <div className="indicator-info">
                                <span className="color-swatch" style={{ backgroundColor: ind.color }} />
                                <label className="indicator-label">
                                    {groupType === 'sma' ? `SMA ${idx + 1}` :
                                        groupType === 'rsi' ? `RSI (${ind.length})` :
                                            groupType === 'macd' ? 'Normalized MACD' :
                                                groupType === 'volume_profile' ? `Volume Profile (${ind.priceBins})` :
                                                    groupType === 'bb' ? `BB (${ind.length}, ${ind.stdDev})` :
                                                        groupType === 'stoch' ? `Stoch (${ind.length}, ${ind.dLength})` :
                                                            groupType === 'supertrend' ? `Supertrend (${ind.atrLength}, ${ind.factor})` :
                                                                groupType === 'atr' ? `ATR (${ind.length})` :
                                                                    groupType === 'ichimoku' ? `Ichimoku Cloud` :
                                                                        groupType === 'tsi' ? `TSI (${ind.longLength}, ${ind.shortLength}, ${ind.signalLength})` : 'Indicator'}
                                </label>
                            </div>
                            <div className="indicator-actions">
                                <button
                                    className={`action-btn ${!ind.visible ? 'hidden' : ''}`}
                                    onClick={() => toggleIndicator(ind.id)}
                                >
                                    {ind.visible ? '👁' : '👁\u200d🗨'}
                                </button>
                                {groupType === 'sma' && (
                                    <button
                                        className="action-btn remove-single"
                                        onClick={() => removeIndicator(ind.id)}
                                        title="Remove specific SMA"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* SMA-Specific Settings */}
                        {groupType === 'sma' && (
                            <div className="indicator-settings">
                                <div className="setting-item">
                                    <label>Len</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.length}
                                        disabled={!ind.visible}
                                        onChange={(e) => updateIndicator(ind.id, { length: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item" style={{ flex: 1 }}>
                                    <label>Source</label>
                                    <select
                                        value={ind.source} disabled={!ind.visible}
                                        onChange={(e) => updateIndicator(ind.id, { source: e.target.value })}
                                    >
                                        {SMA_SOURCES.map(src => <option key={src.value} value={src.value}>{src.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* RSI-Specific Settings */}
                        {groupType === 'rsi' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Length</label>
                                    <input
                                        type="number" min="1" max="100" value={ind.length}
                                        onChange={(e) => updateIndicator(ind.id, { length: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Source</label>
                                    <select
                                        value={ind.source}
                                        onChange={(e) => updateIndicator(ind.id, { source: e.target.value })}
                                    >
                                        {SMA_SOURCES.map(src => <option key={src.value} value={src.value}>{src.label}</option>)}
                                    </select>
                                </div>
                                <div className="setting-item">
                                    <label>Smooth</label>
                                    <select
                                        value={ind.smoothingType}
                                        onChange={(e) => updateIndicator(ind.id, { smoothingType: e.target.value })}
                                    >
                                        <option value="None">None</option>
                                        <option value="SMA">SMA</option>
                                    </select>
                                </div>
                                {ind.smoothingType === 'SMA' && (
                                    <>
                                        <div className="setting-item">
                                            <label>S-Len</label>
                                            <input
                                                type="number" min="1" max="100" value={ind.smoothingLength}
                                                onChange={(e) => updateIndicator(ind.id, { smoothingLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                            />
                                        </div>
                                        <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                                            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={ind.showBB}
                                                    onChange={(e) => updateIndicator(ind.id, { showBB: e.target.checked })}
                                                />
                                                Bollinger Bands
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* MACD-Specific Settings */}
                        {groupType === 'macd' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Fast</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.fastLength}
                                        onChange={(e) => updateIndicator(ind.id, { fastLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Slow</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.slowLength}
                                        onChange={(e) => updateIndicator(ind.id, { slowLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Signal</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.signalLength}
                                        onChange={(e) => updateIndicator(ind.id, { signalLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Norm</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.normLookback}
                                        onChange={(e) => updateIndicator(ind.id, { normLookback: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Volume Profile Settings */}
                        {groupType === 'vp' && (
                            <div className="indicator-settings">
                                <div className="setting-item">
                                    <label>Bins</label>
                                    <input
                                        type="number" min="10" max="200" value={ind.priceBins}
                                        onChange={(e) => updateIndicator(ind.id, { priceBins: Math.max(10, parseInt(e.target.value) || 10) })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Volume Profile Settings */}
                        {groupType === 'volume_profile' && (
                            <div className="indicator-settings">
                                <div className="setting-item">
                                    <label>Bins</label>
                                    <input
                                        type="number" min="10" max="500" value={ind.priceBins}
                                        onChange={(e) => updateIndicator(ind.id, { priceBins: Math.max(10, parseInt(e.target.value) || 10) })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Bollinger Bands Settings */}
                        {groupType === 'bb' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.length}
                                        onChange={(e) => updateIndicator(ind.id, { length: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>StdDev</label>
                                    <input
                                        type="number" step="0.1" min="0.1" max="10" value={ind.stdDev}
                                        onChange={(e) => updateIndicator(ind.id, { stdDev: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Source</label>
                                    <select
                                        value={ind.source}
                                        onChange={(e) => updateIndicator(ind.id, { source: e.target.value })}
                                    >
                                        {['Close', 'Open', 'High', 'Low', 'HL2', 'HLC3', 'OHLC4', 'HLCC4'].map(src => (
                                            <option key={src} value={src}>{src}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="setting-item">
                                    <label>Offset</label>
                                    <input
                                        type="number" value={ind.offset}
                                        onChange={(e) => updateIndicator(ind.id, { offset: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input type="checkbox" checked={ind.showPriceLabels} onChange={(e) => updateIndicator(ind.id, { showPriceLabels: e.target.checked })} /> Lbls
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input type="checkbox" checked={ind.showStatusValues} onChange={(e) => updateIndicator(ind.id, { showStatusValues: e.target.checked })} /> Vals
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input type="checkbox" checked={ind.showInputInStatus} onChange={(e) => updateIndicator(ind.id, { showInputInStatus: e.target.checked })} /> Input
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Stochastic Oscillator Settings */}
                        {groupType === 'stoch' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.length}
                                        onChange={(e) => updateIndicator(ind.id, { length: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>D Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.dLength}
                                        onChange={(e) => updateIndicator(ind.id, { dLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Upper</label>
                                    <input
                                        type="number" min="1" max="100" value={ind.upperLine}
                                        onChange={(e) => updateIndicator(ind.id, { upperLine: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Lower</label>
                                    <input
                                        type="number" min="1" max="100" value={ind.lowerLine}
                                        onChange={(e) => updateIndicator(ind.id, { lowerLine: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        )}
                        {/* SuperTrend Settings */}
                        {groupType === 'supertrend' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>ATR Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.atrLength}
                                        onChange={(e) => updateIndicator(ind.id, { atrLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Factor</label>
                                    <input
                                        type="number" step="0.1" min="0.1" max="20" value={ind.factor}
                                        onChange={(e) => updateIndicator(ind.id, { factor: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                                    />
                                </div>
                            </div>
                        )}
                        {/* ATR Settings */}
                        {groupType === 'atr' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.length}
                                        onChange={(e) => updateIndicator(ind.id, { length: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                            </div>
                        )}
                        {/* Ichimoku Settings */}
                        {groupType === 'ichimoku' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Conv Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.conversionLength}
                                        onChange={(e) => updateIndicator(ind.id, { conversionLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Base Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.baseLength}
                                        onChange={(e) => updateIndicator(ind.id, { baseLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Span B Length</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.spanBLength}
                                        onChange={(e) => updateIndicator(ind.id, { spanBLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Lagging Line</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.laggingLength}
                                        onChange={(e) => updateIndicator(ind.id, { laggingLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                            </div>
                        )}
                        {/* TSI Settings */}
                        {groupType === 'tsi' && (
                            <div className="indicator-settings rsi-grid">
                                <div className="setting-item">
                                    <label>Long Len</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.longLength}
                                        onChange={(e) => updateIndicator(ind.id, { longLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Short Len</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.shortLength}
                                        onChange={(e) => updateIndicator(ind.id, { shortLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                                <div className="setting-item">
                                    <label>Signal</label>
                                    <input
                                        type="number" min="1" max="500" value={ind.signalLength}
                                        onChange={(e) => updateIndicator(ind.id, { signalLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IndicatorGroupPanel;
