import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildMap } = require('../electron/build.cjs');
test('SDK bridge runs sequential tools, passes spaced paths safely and produces a fresh BSP', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-build-'));
  try {
    const binDir = path.join(dir, 'SDK tools'),
      gameDir = path.join(dir, 'Game folder');
    await mkdir(binDir);
    await mkdir(gameDir);
    await writeFile(path.join(gameDir, 'gameinfo.txt'), 'GameInfo {}');
    const map = path.join(dir, 'test_map.vmf');
    for (const name of ['vbsp', 'vvis', 'vrad']) {
      const script = `#!/usr/bin/env node\nconst fs=require('fs');const args=process.argv.slice(2);if(args[0]!=='-game'||args[1]!==${JSON.stringify(gameDir)})process.exit(9);fs.appendFileSync(${JSON.stringify(path.join(dir, 'order'))},${JSON.stringify(name + '\n')});${name === 'vbsp' ? "fs.writeFileSync(args.at(-1).replace(/\\.vmf$/,'.bsp'),'fresh bsp')" : "fs.appendFileSync(args.at(-1),' '+" + JSON.stringify(name) + ')'};console.log(${JSON.stringify(name + ' finished')});\n`;
      await writeFile(path.join(binDir, name), script);
      await chmod(path.join(binDir, name), 0o755);
    }
    await writeFile(map.replace('.vmf', '.bsp'), 'old bsp');
    let log = '';
    const bsp = await buildMap({ binDir, gameDir, fast: true }, 'world {}', map, (s: string) => (log += s), new AbortController().signal);
    assert.equal(await readFile(bsp, 'utf8'), 'fresh bsp vvis vrad');
    assert.equal(await readFile(path.join(dir, 'order'), 'utf8'), 'vbsp\nvvis\nvrad\n');
    assert.equal(await readFile(bsp + '.forge-backup', 'utf8'), 'old bsp');
    assert.ok(log.includes('Build complete'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('invalid config stops before writing', async () => {
  await assert.rejects(
    buildMap({ binDir: 'relative', gameDir: 'relative' }, '', '/tmp/a.vmf', () => {}, new AbortController().signal),
    /absolute/
  );
});
test('compiler failure stops later stages; cancellation terminates the active tool', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-failure-'));
  try {
    const binDir = path.join(dir, 'bin'),
      gameDir = path.join(dir, 'game');
    await mkdir(binDir);
    await mkdir(gameDir);
    await writeFile(path.join(gameDir, 'gameinfo.txt'), 'GameInfo {}');
    for (const name of ['vbsp', 'vvis', 'vrad']) {
      await writeFile(path.join(binDir, name), '#!/usr/bin/env node\nprocess.exit(7);\n');
      await chmod(path.join(binDir, name), 0o755);
    }
    const config = { binDir, gameDir, fast: false };
    const file = path.join(dir, 'failure.vmf');
    let log = '';
    await assert.rejects(
      buildMap(config, 'world {}', file, (s: string) => (log += s), new AbortController().signal),
      /exited with code 7/
    );
    assert.ok(!log.includes('→ vvis'));
    await writeFile(path.join(binDir, 'vbsp'), '#!/usr/bin/env node\nconsole.log("running");setInterval(()=>{},1000);\n');
    const controller = new AbortController();
    await assert.rejects(
      buildMap(
        config,
        'world {}',
        path.join(dir, 'cancel.vmf'),
        (s: string) => {
          if (s.includes('running')) controller.abort();
        },
        controller.signal
      ),
      /cancelled/
    );
    const preCancelled = new AbortController();
    preCancelled.abort();
    await assert.rejects(
      buildMap(config, 'world {}', path.join(dir, 'before.vmf'), () => {}, preCancelled.signal),
      /cancelled/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
