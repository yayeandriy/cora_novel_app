const fs = require('fs');
const postcss = require('postcss');
const tailwindPostcss = require('@tailwindcss/postcss');
const autoprefixer = require('autoprefixer');

const inputPath = 'src/tailwind.input.css';
const outputPath = 'src/styles.css';

async function build() {
  try {
    const input = fs.readFileSync(inputPath, 'utf8');
    const result = await postcss([tailwindPostcss(), autoprefixer()]).process(input, { from: inputPath });
    fs.writeFileSync(outputPath, result.css);
    console.log('Tailwind compiled to', outputPath);
  } catch (err) {
    console.error('Tailwind build failed:', err);
    process.exit(1);
  }
}

build();
