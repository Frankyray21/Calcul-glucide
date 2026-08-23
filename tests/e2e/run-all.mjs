/* Lance chaque *.test.js l'un après l'autre; le premier échec fait
   échouer la CI, mais tous les fichiers s'exécutent quand même pour que
   le journal montre l'étendue des dégâts. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
for (const t of tests) {
  console.log('\n═══ ' + t + ' ═══');
  const r = spawnSync(process.execPath, [path.join(dir, t)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log('\n' + (failed ? failed + ' fichier(s) en échec' : 'Suite complète : OK'));
process.exit(failed ? 1 : 0);
