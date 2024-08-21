import React, { useState, useCallback, useRef } from 'react';

// New function to get the configuration
export const getPrimitiveImageConfig = () => {
  const canvasPadding = 50;
  const largestWidth = 450;
  const secondLargestWidth = 180;
  const smallWidth = 30;
  const textBlockWidth = 50;
  const reducedPadding = 11 / 3;

  const imageLayout = [
    { width: largestWidth, height: largestWidth + 25, left: canvasPadding + 12.5, top: canvasPadding + 12.5, zoom: 1 },
    { width: textBlockWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth + 2.75, top: canvasPadding + 12.5 + largestWidth + 25 - secondLargestWidth - 12.5 - smallWidth - 2.75, zoom: 1 },
    { width: secondLargestWidth, height: secondLargestWidth + 12.5, left: canvasPadding + 12.5 + largestWidth + 2.75, top: canvasPadding + 12.5 + largestWidth + 25 - secondLargestWidth - 12.5, zoom: 1 },
    { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5, top: canvasPadding + 12.5 - smallWidth - 2.75, zoom: 1 },
    { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth - smallWidth, top: canvasPadding + 12.5 + largestWidth + 25 + 2.75, zoom: 1 },
    { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth - smallWidth + smallWidth + reducedPadding, top: canvasPadding + 12.5 + largestWidth + 25 + 2.75, zoom: 1 },
    { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth - smallWidth + 2 * (smallWidth + reducedPadding), top: canvasPadding + 12.5 + largestWidth + 25 + 2.75, zoom: 1 },
  ];

  const canvasWidth = largestWidth + secondLargestWidth + canvasPadding * 2 + 2.75;
  const canvasHeight = largestWidth + 25 + canvasPadding * 2;

  return {
    imageLayout,
    canvasWidth,
    canvasHeight
  };
};

const PrimitiveImageRectangle = ({ rect, onMove, images, texts }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Use the configuration function
  const { imageLayout, canvasWidth, canvasHeight } = getPrimitiveImageConfig();

  const isOverVisiblePart = (e) => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return imageLayout.some(layout => 
      x >= layout.left && x <= layout.left + layout.width &&
      y >= layout.top && y <= layout.top + layout.height
    );
  };

  const handleMouseDown = (e) => {
    if (isOverVisiblePart(e)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - rect.x, y: e.clientY - rect.y });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      onMove(rect.id, newX, newY);
    }
  }, [isDragging, dragStart, onMove, rect.id]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
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
      ref={containerRef}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: canvasWidth,
        height: canvasHeight,
        cursor: isDragging ? 'grabbing' : 'grab',
        // ... (other styles remain the same)
      }}
      onMouseDown={handleMouseDown}
    >
      {imageLayout.map((layout, index) => (
        <div key={index} style={{
          position: 'absolute',
          left: layout.left,
          top: layout.top,
          width: layout.width,
          height: layout.height,
          overflow: 'hidden',
        }}>
          {images && images[index] && (
          <img 
            src={`${process.env.REACT_APP_API_URL}/images/${images[index] || images[0]}`}
            alt={`Section ${index + 1}`} 
            onError={(e) => console.error(`Error loading image: ${e.target.src}`)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }} 
          />
        )}
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: 5, right: 5, display: 'flex', justifyContent: 'space-around', padding: '5px' }}>
        {texts.map((text, index) => (
          <span key={index} style={{ marginRight: '5px', fontSize: '12px' }}>{text || `${index + 1}`}</span>
        ))}
      </div>
    </div>
  );
};

export default PrimitiveImageRectangle;