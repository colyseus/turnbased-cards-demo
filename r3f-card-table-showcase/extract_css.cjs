const fs = require('fs');
const htmlPath = '../design-system/showcase.html';
const html = fs.readFileSync(htmlPath, 'utf8');

const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>', styleStart);

if (styleStart !== -1 && styleEnd !== -1) {
  const css = html.substring(styleStart + '<style>'.length, styleEnd);
  
  const rootCss = `
/* R3F Base Setup */
body {
  margin: 0;
}

#root {
  width: 100%;
  margin: 0;
  padding: 0;
}
`;

  fs.writeFileSync('src/index.css', rootCss + css);
  console.log('Successfully extracted CSS to src/index.css');
} else {
  console.log('Could not find <style> tags.');
}
