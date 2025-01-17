import React, { useState, useCallback, useRef } from 'react';

// New function to get the configuration
export const getPrimitiveImageConfig = () => {
  const canvasPadding = 50;
  const largestWidth = (Math.random()<1)? 450 : 660 ;
  const secondLargestWidth =largestWidth* 0.61;
  const smallWidth = largestWidth*0.305;
  const textBlockWidth = 50;
  const reducedPadding = 11 / 3;

  const imageLayout = [
    { width: largestWidth, height: largestWidth + 25, left: canvasPadding + 12.5, top: canvasPadding + 12.5, zoom: 1 },
    // { width: textBlockWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth + 2.75, top: canvasPadding + 12.5 + largestWidth + 25 - secondLargestWidth - 12.5 - smallWidth - 2.75, zoom: 1 },
    // { width: secondLargestWidth, height: secondLargestWidth + 12.5, left: canvasPadding + 12.5 + largestWidth + 2.75, top: canvasPadding + 12.5 + largestWidth + 25 - secondLargestWidth - 12.5, zoom: 1 },
    // { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5, top: canvasPadding + 12.5 - smallWidth - 2.75, zoom: 1 },
    // { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth - smallWidth, top: canvasPadding + 12.5 + largestWidth + 25 + 2.75, zoom: 1 },
    // { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth - smallWidth + smallWidth + reducedPadding, top: canvasPadding + 12.5 + largestWidth + 25 + 2.75, zoom: 1 },
    // { width: smallWidth, height: smallWidth, left: canvasPadding + 12.5 + largestWidth - smallWidth + 2 * (smallWidth + reducedPadding), top: canvasPadding + 12.5 + largestWidth + 25 + 2.75, zoom: 1 },
  ];

  const canvasWidth = largestWidth ;
  const canvasHeight = largestWidth ;

  return {
    imageLayout,
    canvasWidth,
    canvasHeight
  };
};

const PrimitiveImageRectangle = ({ rect, onMove, images, texts, zoom, panOffset,imageEffects=[] }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Use the configuration function
  const { imageLayout, canvasWidth, canvasHeight } = getPrimitiveImageConfig();

  const isOverVisiblePart = (e) => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;


    return imageLayout.some(layout => 
      x >= layout.left && x <= layout.left + layout.width &&
      y >= layout.top && y <= layout.top + layout.height
    );
  };

  const handleMouseDown = (e) => {
    if (isOverVisiblePart(e)) {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX / zoom - rect.x, 
        y: e.clientY / zoom - rect.y 
      });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newX = e.clientX / zoom - dragStart.x;
      const newY = e.clientY / zoom - dragStart.y;
      onMove(rect.id, newX, newY);
    }
  }, [isDragging, dragStart, onMove, rect.id, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getImageStyle = (index) => {
    const effect = imageEffects[index] || {};
    let style = {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    };

    if (effect.hardlight){
      style.mixBlendMode= 'hard-light'
    }

    if (effect.greyscale) {
      style.filter = `${style.filter || ''} grayscale(100%)`;
    }

    if (effect.exposure !== undefined) {
      style.filter = `${style.filter || ''} brightness(${100 + effect.exposure}%)`;
    }

    if (effect.overlay) {
      style.mixBlendMode = 'overlay';
    }

    if (effect.multiply) {
      style.mixBlendMode = 'multiply';
    }

    if (effect.difference) {
      style.mixBlendMode = 'difference';
    }

    return style;
  };

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
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`, // Use rect.width instead of canvasWidth
        height: `${rect.height}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
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
            style={getImageStyle(index)}
            // style={{
            //   width: '100%',
            //   height: '100%',
            //   objectFit: 'cover',
            // }} 
          />
        )}
        </div>
      ))}
    </div>
  );
};

export default PrimitiveImageRectangle;