import React from 'react';

const DrawingToolbar = ({ activeTool, onSelectTool }) => {
    const [openCategory, setOpenCategory] = React.useState(null);

    const categories = [
        {
            id: 'cursor_cat',
            type: 'single',
            tool: { id: 'cursor', icon: '↖️', label: 'Cursor' }
        },
        {
            id: 'trend_cat',
            type: 'group',
            label: 'Trend Line Tools',
            icon: '╱',
            tools: [
                { id: 'trend', icon: '╱', label: 'Trend Line' },
                { id: 'arrow', icon: '↗', label: 'Arrow' },
                { id: 'ray', icon: '→', label: 'Ray' },
                { id: 'extendedLine', icon: '⟷', label: 'Extended Line' },
                { id: 'infoLine', icon: 'ⓘ', label: 'Info Line' },
                { id: 'trendAngle', icon: '∠', label: 'Trend Angle' },
                { id: 'horizontalLine', icon: '―', label: 'Horizontal Line' },
                { id: 'horizontalRay', icon: '⎯→', label: 'Horizontal Ray' },
                { id: 'verticalLine', icon: '｜', label: 'Vertical Line' },
                { id: 'crossLine', icon: '╓', label: 'Cross Line' },
            ]
        },
        {
            id: 'channels_cat',
            type: 'group',
            label: 'Channels',
            icon: '▚',
            tools: [
                { id: 'parallelChannel', icon: '⫖', label: 'Parallel Channel' },
                { id: 'regressionTrend', icon: '📈', label: 'Regression Trend' },
                { id: 'flatTopBottom', icon: '⌸', label: 'Flat Top / Bottom' },
                { id: 'disjointChannel', icon: '⩕', label: 'Disjoint Channel' },
            ]
        },
        {
            id: 'shapes_cat',
            type: 'group',
            label: 'Shapes',
            icon: '⬛',
            tools: [
                { id: 'rectangle', icon: '⬜', label: 'Rectangle' },
                { id: 'rotatedRectangle', icon: '▱', label: 'Rotated Rectangle' },
                { id: 'circle', icon: '○', label: 'Circle' },
                { id: 'ellipse', icon: '◯', label: 'Ellipse' },
                { id: 'triangle', icon: '△', label: 'Triangle' },
                { id: 'polyline', icon: '⌇', label: 'Polyline' },
                { id: 'curve', icon: '⌒', label: 'Curve' },
                { id: 'doubleCurve', icon: '∼', label: 'Double Curve' },
                { id: 'arc', icon: '◡', label: 'Arc' },
            ]
        },
        {
            id: 'measure_cat',
            type: 'group',
            label: 'Measurement Tools',
            icon: '📏',
            tools: [
                { id: 'longPosition', icon: '📈', label: 'Long Position' },
                { id: 'shortPosition', icon: '📉', label: 'Short Position' },
                { id: 'forecast', icon: '🔮', label: 'Forecast' },
                { id: 'priceRange', icon: '↕', label: 'Price Range' },
                { id: 'dateRange', icon: '↔', label: 'Date Range' },
                { id: 'ghostFeed', icon: '👻', label: 'Ghost Feed' },
            ]
        },
        {
            id: 'fib_cat',
            type: 'group',
            label: 'Gann & Fibonacci',
            icon: '≡',
            tools: [
                { id: 'fibRetracement', icon: '≡', label: 'Fib Retracement' },
                { id: 'fibExtension', icon: '↗', label: 'Trend-Based Fib Extension' },
                { id: 'fibSpeedArcs', icon: '➰', label: 'Fib Speed Resistance Arcs' },
                { id: 'fibFan', icon: '∠', label: 'Fib Fan' },
                { id: 'fibTimeZone', icon: '◴', label: 'Fib Time Zone' },
                { id: 'fibChannel', icon: '⧬', label: 'Fib Channel' },
                { id: 'fibWedge', icon: '◹', label: 'Fib Wedge' },
                { id: 'fibSpiral', icon: '🌀', label: 'Fib Spiral' },
                { id: 'fibCircles', icon: '◎', label: 'Fib Circles' },
                { id: 'gannFan', icon: '📐', label: 'Gann Fan' },
                { id: 'gannSquare', icon: '⊞', label: 'Gann Square' },
                { id: 'gannBox', icon: '⊠', label: 'Gann Box' },
            ]
        },
        {
            id: 'utils_cat',
            type: 'single',
            tool: { id: 'eraser', icon: '🧹', label: 'Clear All' }
        }
    ];

    const handleToolSelect = (toolId, categoryId) => {
        onSelectTool(toolId);
        setOpenCategory(null);
    };

    return (
        <div className="drawing-toolbar">
            {categories.map((cat) => (
                <div key={cat.id} className="toolbar-category-container">
                    {cat.type === 'single' ? (
                        <button
                            className={`drawing-tool-btn ${activeTool === cat.tool.id ? 'active' : ''}`}
                            onClick={() => onSelectTool(cat.tool.id)}
                            title={cat.tool.label}
                        >
                            <span className="tool-icon">{cat.tool.icon}</span>
                        </button>
                    ) : (
                        <>
                            <button
                                className={`drawing-tool-btn group-btn ${cat.tools.some(t => t.id === activeTool) ? 'active' : ''}`}
                                onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
                                title={cat.label}
                            >
                                <span className="tool-icon">{cat.icon}</span>
                                <span className="category-arrow">›</span>
                            </button>

                            {openCategory === cat.id && (
                                <div className="tool-flyout">
                                    <div className="flyout-header">{cat.label}</div>
                                    <div className="flyout-grid">
                                        {cat.tools.map(tool => (
                                            <button
                                                key={tool.id}
                                                className={`flyout-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                                                onClick={() => handleToolSelect(tool.id, cat.id)}
                                                title={tool.label}
                                            >
                                                <span className="tool-icon">{tool.icon}</span>
                                                <span className="tool-label">{tool.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

export default DrawingToolbar;
