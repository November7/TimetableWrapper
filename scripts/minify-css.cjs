const fs = require('node:fs');
const path = require('node:path');
const CleanCSS = require('clean-css');

const root = path.resolve(__dirname, '..');
const result = new CleanCSS().minify(fs.readFileSync(path.join(root, 'css/app.css'), 'utf8'));
if (result.errors.length) {
  throw new Error(result.errors.join('\n'));
}
for (const warning of result.warnings) console.warn(warning);
fs.writeFileSync(path.join(root, 'css/app.min.css'), result.styles);
