import type { KV } from '../model';

/** Lossless key/value tree codec: preserves repeated keys and unknown chunks. */
export function parseVMF(text: string): KV[] {
  // Tokenize quoted strings, comments and braces without losing repeated keys.
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    if (text.slice(i, i + 2) === '//') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if ('{}'.includes(text[i])) {
      tokens.push(text[i++]);
      continue;
    }
    if (text[i] === '"') {
      i++;
      let s = '';
      let closed = false;
      while (i < text.length) {
        const c = text[i++];
        if (c === '"') {
          closed = true;
          break;
        }
        if (c === '\\' && ['"', '\\'].includes(text[i])) s += text[i++];
        else s += c;
      }
      if (!closed) throw Error('Unterminated VMF string');
      tokens.push(JSON.stringify(s));
      continue;
    }
    let s = '';
    while (i < text.length && !/[\s{}]/.test(text[i])) s += text[i++];
    tokens.push(JSON.stringify(s));
  }
  let t = 0;
  function block(nested = false): KV[] {
    const nodes: KV[] = [];
    while (t < tokens.length) {
      if (tokens[t] === '}') {
        if (!nested) throw Error('Unexpected closing brace');
        t++;
        return nodes;
      }
      const key = tokens[t++];
      if (key === '{') throw Error('Expected a VMF key');
      if (tokens[t] === '{') {
        t++;
        nodes.push({ name: JSON.parse(key), children: block(true) });
      } else {
        const value = tokens[t++];
        if (!value || '{}'.includes(value)) throw Error('Missing VMF value');
        nodes.push({ name: JSON.parse(key), value: JSON.parse(value) });
      }
    }
    if (nested) throw Error('Unclosed VMF block');
    return nodes;
  }
  return block();
}
export function writeVMF(nodes: KV[], depth = 0): string {
  const tab = '\t'.repeat(depth);
  return nodes
    .map(n => (n.value !== undefined ? `${tab}${JSON.stringify(n.name)} ${JSON.stringify(n.value)}\n` : `${tab}${n.name}\n${tab}{\n${writeVMF(n.children ?? [], depth + 1)}${tab}}\n`))
    .join('');
}
