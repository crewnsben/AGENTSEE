import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { wrapText } from './textUtils';
import Typewriter from 'typewriter-effect';

const PrimitiveInputRectangle = ({ rect, onMove, zoom }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const maxWidth = 300; // Maximum width of the rectangle
  const maxHeight = 400; // Maximum height of the rectangle
  const columnGap = 10; // Gap between columns

  const { columns, totalWidth } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${14 * zoom}px Arial`;

    const maxColumnWidth = (maxWidth * zoom - columnGap * 2) / 3; // Divide into 3 columns max
    const lines = wrapText(context, rect.text, maxColumnWidth);
    
    const columnsRequired = Math.ceil(lines.length * (14 * zoom * 1.2) / (maxHeight * zoom));
    const columns = [];
    
    for (let i = 0; i < columnsRequired; i++) {
      const startIndex = i * Math.floor(lines.length / columnsRequired);
      const endIndex = (i + 1) * Math.floor(lines.length / columnsRequired);
      columns.push(lines.slice(startIndex, endIndex));
    }

    const totalWidth = Math.min(columns.length * (maxWidth * zoom), 900 * zoom); // Max width of 900px

    return { columns, totalWidth };
  }, [rect.text, zoom, maxWidth, maxHeight]);

  const renderText = () => {
    return columns.map((column, columnIndex) => (
      <div key={columnIndex} style={{
        width: `${(totalWidth - columnGap * (columns.length - 1)) / columns.length}px`,
        marginRight: columnIndex < columns.length - 1 ? `${columnGap}px` : '0',
      }}>
        {column.map((line, lineIndex) => (
          <div key={lineIndex} style={{ 
            fontWeight: lineIndex === 0 && columnIndex === 0 ? 'bold' : 'normal',
            opacity: lineIndex === 0 && columnIndex === 0 ? 1 : 0.7,
            fontSize: `${14 * zoom}px`,
            lineHeight: `${14 * zoom * 1.2}px`,
            whiteSpace: 'pre-wrap'
          }}>
            {columnIndex === 0 && lineIndex === 0 ? (
              <Typewriter
                options={{
                  strings: [line],
                  autoStart: true,
                  loop: false,
                }}
              />
            ) : line}
          </div>
        ))}
      </div>
    ));
  };


  // No changes to drag handling logic
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - rect.x, y: e.clientY - rect.y });
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      onMove(rect.id, newX, newY);
    }
  }, [isDragging, dragStart.x, dragStart.y, onMove, rect.id]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

 
    return (
      <div 
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: `${totalWidth}px`, // Use calculated totalWidth
          height: `${maxHeight * zoom}px`,
        backgroundColor: '#F5F5F5',
        borderRadius: '0px',
        border: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)', //#_________________________________________________________________________________________________________________________
        overflow:'visible',
        display: 'flex',
        flexDirection: 'row',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Blue tab */}
      <div
        style={{
          position: 'absolute',
          top: '0px',
          right: '0px',
          width: `${60 * zoom}px`,
          height: `${20 * zoom}px`,
          backgroundColor: '#0000FF',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
          fontSize: `${9 * zoom}px`,
          fontWeight: 'bold',
          borderBottomLeftRadius: '5px',
        }}
      >
        whisper
      </div>

      {/* Text content */}
      <div
        style={{
          padding: `${10 * zoom}px`,
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          overflowY: 'auto',
        }}
      >
        {renderText()}
      </div>

      {/* Index number */}
      <div
        style={{
          position: 'absolute',
          bottom: `${-20 * zoom}px`,
          right: `${10 * zoom}px`,
          fontSize: `${12 * zoom}px`,
          color: '#999999',
        }}
      >
        {`index_${rect.indexNumber?.toString().padStart(3, '0')}`}
      </div>
    </div>
  );
};

export default PrimitiveInputRectangle;