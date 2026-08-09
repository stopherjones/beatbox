import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const files = fs.readdirSync(publicDir)
  .filter(file => file.endsWith('.json'))
  .map(file => ({
    label: file
      .replace('.json', '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()), // Clean up names nicely (e.g., "reggae-track" -> "Reggae Track")
    path: `./${file}`
  }));

fs.writeFileSync(
  path.join(publicDir, 'project-manifest.json'), 
  JSON.stringify(files, null, 2)
);
console.log('Successfully generated project manifest for:', files.map(f => f.label));