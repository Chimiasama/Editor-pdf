import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

if (!existsSync('dist/index.html')) {
  throw new Error('Execute npm run build antes de preparar o Android.');
}
const cap = 'node_modules/@capacitor/cli/bin/capacitor';
if (!existsSync('android')) {
  execFileSync(process.execPath, [cap, 'add', 'android'], { stdio: 'inherit' });
}
execFileSync(process.execPath, [cap, 'sync', 'android'], { stdio: 'inherit' });
