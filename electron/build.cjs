const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
async function buildMap(config, vmf, mapPath, log, signal) {
  for (const key of ['binDir', 'gameDir']) if (typeof config[key] !== 'string' || !path.isAbsolute(config[key])) throw Error(`Choose an absolute ${key} path.`);
  if (!path.isAbsolute(mapPath) || path.extname(mapPath).toLowerCase() !== '.vmf') throw Error('Choose a VMF output file.');
  if (!/^[a-zA-Z0-9_-]+$/.test(path.basename(mapPath, '.vmf'))) throw Error('Map names may contain only letters, numbers, underscores and hyphens.');
  await fs.access(path.join(config.gameDir, 'gameinfo.txt'));
  const tools = ['vbsp', 'vvis', 'vrad'].map(n => path.join(config.binDir, n + (process.platform === 'win32' ? '.exe' : '')));
  for (const file of tools) await fs.access(file);
  if (signal.aborted) throw Error('Build cancelled');
  await fs.writeFile(mapPath, vmf, 'utf8');
  const bsp = mapPath.slice(0, -4) + '.bsp';
  // Remove stale output so a failed compiler cannot report an old map as success.
  try {
    await fs.rename(bsp, bsp + '.forge-backup');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  for (let i = 0; i < tools.length; i++) {
    if (signal.aborted) throw Error('Build cancelled');
    const args = ['-game', config.gameDir, ...(i > 0 && config.fast ? ['-fast'] : []), i === 0 ? mapPath : bsp];
    log(`\n→ ${path.basename(tools[i])} ${args.map(a => JSON.stringify(a)).join(' ')}\n`);
    await new Promise((resolve, reject) => {
      let done = false;
      const child = spawn(tools[i], args, { cwd: config.binDir, windowsHide: true, shell: false });
      const stop = () => {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
        else child.kill('SIGTERM');
      };
      signal.addEventListener('abort', stop, { once: true });
      child.stdout.on('data', s => log(s.toString()));
      child.stderr.on('data', s => log(s.toString()));
      const finish = err => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', stop);
        err ? reject(err) : resolve();
      };
      child.on('error', e => finish(e));
      child.on('close', code => finish(signal.aborted ? Error('Build cancelled') : code === 0 ? null : Error(`${path.basename(tools[i])} exited with code ${code}`)));
    });
    await fs.access(bsp);
  }
  log(`\n✓ Build complete: ${bsp}\n`);
  return bsp;
}
module.exports = { buildMap };
