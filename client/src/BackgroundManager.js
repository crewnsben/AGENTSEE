// BackgroundManager.js
import React from 'react';
import PropTypes from 'prop-types';

const BackgroundManager = ({ colors, gridSize = 50 }) => {
  const safeColors = colors.filter(color => color && typeof color === 'string');
  
  let gradientStyle;
  if (safeColors.length === 0) {
    gradientStyle = '#EBEBEB';
  } else if (safeColors.length === 1) {
    gradientStyle = safeColors[0];
  } else {
    const gradient = safeColors.map((color, index) => {
      const percentage = (index / (safeColors.length - 1)) * 100;
      return `${color} ${percentage}%`;
    }).join(', ');
    gradientStyle = `linear-gradient(to bottom right, ${gradient})`;
  }

  const style = {
    background: gradientStyle,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    zIndex: -1
  };

  const gridStyle = {
    backgroundImage: `
      linear-gradient(to right, #00000010 1px, transparent 1px),
      linear-gradient(to bottom, #00000010 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px`,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  return (
    <div style={style}>
      <div style={gridStyle} />
    </div>
  );
};

BackgroundManager.propTypes = {
  colors: PropTypes.arrayOf(PropTypes.string),
  gridSize: PropTypes.number
};

BackgroundManager.defaultProps = {
  colors: ['D9D9D9'],
  gridSize: 10
};

export default BackgroundManager;