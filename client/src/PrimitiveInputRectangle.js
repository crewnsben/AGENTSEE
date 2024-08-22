import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { wrapText } from './textUtils';
import Typewriter from 'typewriter-effect';

const PrimitiveInputRectangle = ({ rect, onMove, zoom,isLinked,panOffset }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const maxWidth = 300; // Maximum width of the rectangle
  const maxHeight = 400; // Maximum height of the rectangle
  const columnGap = 10; // Gap between columns

  const isResponse = rect.id.startsWith('res');

  const { columns, totalWidth } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${14 * zoom}px Arial`;

    const maxColumnWidth = maxWidth * zoom - columnGap * 2; // Divide into 3 columns max
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
  
  const renderConnectionPoints = () => {
    if (!isLinked) return null;

    return (
      <>
        <div style={{
          position: 'absolute',
          right: '-5px',
          top: '50%',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'dimgrey',
          transform: 'translateY(-50%)',
        }} />
        <div style={{
          position: 'absolute',
          left: '-5px',
          top: '50%',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'dimgrey',
          transform: 'translateY(-50%)',
        }} />
                <div style={{
          position: 'absolute',
          left: '50%',
          top: '0%',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'black',
          transform: 'translateX(-50%)',
        }} />
                <div style={{
          position: 'absolute',
          left: '50%',
          top: '100%',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'black',
          transform: 'translateX(-50%)',
        }} />
      </>
    );
  };

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
            whiteSpace: 'pre-wrap',
            color: isResponse ? '#f5f5f5' : 'inherit', // Dark blue text for responses
          }}>
            {columnIndex === 0 && lineIndex === 0 ? (
              <Typewriter
                options={{
                  strings: [line],
                  autoStart: true,
                  loop: false,
                  deleteSpeed: 9999999,
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
        id={rect.id}
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: `${totalWidth}px`,
          height: `${maxHeight * zoom}px`,
          borderRadius: isResponse ? '10px' : '0px',
          border: 'none', // Royal blue border for responses
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: '0 4px 8px rgba(0,0,0,0)',
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          padding: `${20 * zoom}px`,
          flexDirection: 'row',
          backgroundColor: 'transparent', // Light blue background for responses
        }}
      onMouseDown={handleMouseDown}
    >
      {/* Blue tab */}
      <div
        style={{
          position: 'absolute',
          top: '0px',
          right: `${20 * zoom}px`,
          width: isResponse? '33%':`${60 * zoom}px`,
          height: `${20 * zoom}px`,
          backgroundColor: isResponse ? '#36454F' : '#0000FF',
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
        {isResponse ? 'Agent Response' : 'whisper'}
      </div>

      {/* Text content */}
      <div
        style={{
          padding: `${20 * zoom}px`,
          display: 'flex',
          flexDirection: 'row',
          height: '90%',
          overflowY: 'hidden',
          backgroundColor: isResponse? '#2b2b2b':'#f5f5f5',
        }}
      >
        {renderText()}
      </div>

      {/* Index number */}
      <div
        style={{
          position: 'absolute',
          bottom: `${-30 * zoom}px`,
          height: '10%',
          right: `${20 * zoom}px`,
          fontSize: `${14 * zoom}px`,
          fontWeight: `${400 * zoom}px`,
          alignContent:'center',
          color: '#999999', // Royal blue for responses
        }}
      >
        {`index_${rect.indexNumber?.toString().padStart(3, '0')}`}
      </div>
      {renderConnectionPoints()}
    </div>
  );
};

export default PrimitiveInputRectangle;