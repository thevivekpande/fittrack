import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'dist');
const target = join(root, 'android/app/src/main/assets/web');
try {
  const html = await readFile(join(source, 'index.html'), 'utf8');
  if (!(await stat(source)).isDirectory() || !html.includes('<html')) throw new Error('Invalid dist/index.html');
  await mkdir(dirname(target), { recursive: true });
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true, dereference: false, filter: entry => !entry.endsWith('.map') });
  console.log('Bundled dist into android/app/src/main/assets/web. Re-run after each web build.');
} catch (error) {
  console.error(`Could not prepare Android assets: ${error.message}\nRun npm run build first.`);
  process.exitCode = 1;
}
