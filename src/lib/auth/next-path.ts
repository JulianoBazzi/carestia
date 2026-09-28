const ORIGIN_PROBE = 'http://carestia.invalid';

/**
 * Lê o parâmetro `next` da query string do login e só o aceita como caminho
 * RELATIVO ao site (`/algo`). Evita open redirect: rejeita `//host`, `http…`,
 * barras invertidas, caracteres de controle (o navegador descarta `\t`/`\n`, e
 * `/\t/evil.com` viraria `//evil.com`) e qualquer coisa que, resolvida contra a
 * própria origem, aponte para outro host.
 */
export function safeNextPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next) {
    return null;
  }
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return null;
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: é exatamente o que queremos barrar.
  if (/[\u0000-\u001f\u007f]/.test(next)) {
    return null;
  }
  if (/^\/[^/]*:/.test(next.split('?')[0])) {
    return null;
  }
  try {
    const resolved = new URL(next, ORIGIN_PROBE);
    if (resolved.origin !== ORIGIN_PROBE) {
      return null;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}
