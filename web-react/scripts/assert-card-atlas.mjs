import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { URL } from 'node:url';
import ts from 'typescript';

const source = readFileSync(new URL('../src/cards/cardAtlas.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const { getCardUVs } = await import(moduleUrl);

const ids = ['red_4', 'wild', 'wild_draw4', 'back'];
const cells = ids.map((id) => {
  const { u, v, w, h } = getCardUVs(id);
  return `${u},${v},${w},${h}`;
});

if (new Set(cells).size !== ids.length) {
  throw new Error(`Expected distinct atlas cells for ${ids.join(', ')}, got ${cells.join(' | ')}`);
}

process.stdout.write(`Card atlas assertions passed for ${ids.join(', ')}\n`);
