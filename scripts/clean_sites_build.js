import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve('.');
const outputDirectory = path.resolve('dist');
if (path.dirname(outputDirectory) !== workspace || path.basename(outputDirectory) !== 'dist') {
  throw new Error(`Refusing to clean unexpected build path: ${outputDirectory}`);
}
fs.rmSync(outputDirectory, { recursive: true, force: true });
