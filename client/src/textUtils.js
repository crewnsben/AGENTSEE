export const wrapText = (context, text, maxWidth) => {
  if (maxWidth <= 0) return [];
  const paragraphs = text.split('\n');
  const lines = [];

  paragraphs.forEach(paragraph => {
    if (paragraph.trim() === '') {
      lines.push(''); // Add empty line for paragraph breaks
      return;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth) {
        if (currentLine !== '') {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // If a single word is too long, split it
          let partialWord = word;
          while (partialWord.length > 0) {
            let i = 0;
            while (i < partialWord.length) {
              const testPart = partialWord.slice(0, i + 1);
              if (context.measureText(testPart).width > maxWidth) {
                if (i > 0) {
                  lines.push(partialWord.slice(0, i));
                  partialWord = partialWord.slice(i);
                } else {
                  lines.push(partialWord.slice(0, 1));
                  partialWord = partialWord.slice(1);
                }
                break;
              }
              i++;
            }
            if (i === partialWord.length) {
              currentLine = partialWord;
              break;
            }
          }
        }
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine !== '') lines.push(currentLine);
  });

  return lines;
};


export const calculateTextDimensions = (text, fontSize, maxWidth, padding = { top: 10, right: 10, bottom: 10, left: 10 }) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = `${fontSize}px Arial`;

  const lines = wrapText(context, text, maxWidth - padding.left - padding.right);
  const lineHeight = fontSize * 1.2;
  const textHeight = lines.length * lineHeight;
  
  const width = maxWidth;
  const height = textHeight + padding.top + padding.bottom;

  return { width, height, lines };
};