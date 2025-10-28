const fs = require('fs');
const postcss = require('postcss');
const tailwindPostcss = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');
const path = require('path');

const inputPath = 'src/tailwind.input.css';
const outputPath = 'src/styles.css';

async function build() {
  try {
    const input = fs.readFileSync(inputPath, 'utf8');
    const result = await postcss([
      tailwindPostcss({ base: path.dirname(path.resolve(inputPath)) }), 
      autoprefixer()
    ]).process(input, { 
      from: inputPath,
      to: outputPath 
    });
    
    // Preserve custom styles
    const customStyles = `
/* You can add global styles to this file, and also import other style files */

html, body, #app-root {
	height: 100%;
}

/* small helper for the demo admin area */
.admin { padding: 1rem; }
.projects table { width: 100%; }
`;
    
    fs.writeFileSync(outputPath, result.css + customStyles);
    console.log('✓ Tailwind compiled to', outputPath);
  } catch (err) {
    console.error('Tailwind build failed:', err);
    process.exit(1);
  }
}

build();
