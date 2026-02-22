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
                className={`indicator-panel minimized ${groupType === 'rsi' ? 'has-rsi' : ''}`}
                onClick={() => setIsMinimized(false)}
                title={`Expand ${title} settings`}
            >
                <div className="minimized-header">
                    <span>{groupType === 'rsi' ? '📊 RSI' : '📈 SMA'}</span>
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
                                    {groupType === 'sma' ? `SMA ${idx + 1}` : (groupType === 'rsi' ? `RSI (${ind.length})` : 'Normalized MACD')}
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
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IndicatorGroupPanel;
