import React from 'react';

const DrawingToolbar = ({ activeTool, onSelectTool }) => {
    const tools = [
        { id: 'cursor', icon: '↖️', label: 'Cursor' },
        { id: 'trend', icon: '╱', label: 'Trend Line' },
        { id: 'ray', icon: '→', label: 'Ray' },
        { id: 'extendedLine', icon: '⟷', label: 'Extended Line' },
        { id: 'horizontalLine', icon: '―', label: 'Horizontal Line' },
        { id: 'horizontalRay', icon: '⎯→', label: 'Horizontal Ray' },
        { id: 'verticalLine', icon: '｜', label: 'Vertical Line' },
        { id: 'crossLine', icon: '╓', label: 'Cross Line' },
        { id: 'triangle', icon: '△', label: 'Triangle' },
        { id: 'ellipse', icon: '◯', label: 'Ellipse' },
        { id: 'eraser', icon: '🧹', label: 'Clear All' },
    ];

    return (
        <div className="drawing-toolbar">
            {tools.map(tool => (
                <button
                    key={tool.id}
                    className={`drawing-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                    onClick={() => onSelectTool(tool.id)}
                    title={tool.label}
                >
                    <span className="tool-icon">{tool.icon}</span>
                </button>
            ))}
        </div>
    );
};

export default DrawingToolbar;
