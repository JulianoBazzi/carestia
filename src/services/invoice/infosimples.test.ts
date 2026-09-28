// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchInvoiceByKey, isInfosimplesEnabled } from '~/services/invoice/infosimples';

const NFCE_KEY = '51260705931411000629655290001984931400716910'; // modelo 65 (dígitos 21–22)
const NFE_KEY = '51260702760668000677550010000123451000123456'; // modelo 55

const nfceRecord = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/infosimples-nfce.json'), 'utf-8'),
);

function jsonResponse(payload: unknown) {
  return { ok: true, json: async () => payload } as Response;
}

/** Último POST feito para a API de consultas (endpoint + body já desserializado). */
function lastQuery() {
  const calls = vi.mocked(globalThis.fetch).mock.calls;
  const [url, init] = calls[0];
  return { url: String(url), body: JSON.parse(String(init?.body)) };
}

describe('fetchInvoiceByKey', () => {
  beforeEach(() => {
    vi.stubEnv('INFOSIMPLES_TOKEN', 'token-teste');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('consulta a NFC-e no endpoint certo e com o parâmetro `nfce`', async () => {
    // Regressão: o parâmetro MUDA por endpoint — mandar `nfe` aqui faz a
    // consulta falhar antes de qualquer coisa.
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ code: 200, data: [nfceRecord] }));

    await fetchInvoiceByKey(NFCE_KEY);

    const { url, body } = lastQuery();
    expect(url).toContain('/consultas/sefaz-nfce');
    expect(body).toMatchObject({ nfce: NFCE_KEY, token: 'token-teste' });
    expect(body).not.toHaveProperty('nfe');
  });

  it('consulta a NF-e com o parâmetro `nfe`', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ code: 200, data: [{ url_xml: 'https://exemplo/nota.xml' }] }),
    );

    await fetchInvoiceByKey(NFE_KEY);

    const { url, body } = lastQuery();
    expect(url).toContain('/consultas/sefaz-nfe');
    expect(body).toMatchObject({ nfe: NFE_KEY });
  });

  it('estrutura a NFC-e a partir do JSON, que não traz `url_xml`', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ code: 200, data: [nfceRecord] }));

    const outcome = await fetchInvoiceByKey(NFCE_KEY);

    expect(outcome.status).toBe('parsed');
    if (outcome.status !== 'parsed') {
      return;
    }
    expect(outcome.parsed.invoice.model).toBe('nfce');
    expect(outcome.parsed.company.document).toBe('05931411000629');
    expect(outcome.parsed.items).toHaveLength(5);
    // Uma única chamada: não tentou baixar XML nenhum.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('baixa o XML quando a resposta traz `url_xml` (caminho da NF-e, inalterado)', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: [{ url_xml: 'https://x/nota.xml' }] }))
      .mockResolvedValueOnce({ ok: true, text: async () => '<nfeProc/>' } as Response);

    const outcome = await fetchInvoiceByKey(NFE_KEY);

    expect(outcome).toEqual({ status: 'xml', xml: '<nfeProc/>' });
  });

  it('recusa nota cancelada', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ code: 200, data: [{ ...nfceRecord, cancelada: true }] }),
    );

    const outcome = await fetchInvoiceByKey(NFCE_KEY);

    expect(outcome).toEqual({ status: 'error', message: 'Nota fiscal cancelada.' });
  });

  it('devolve not_found nos códigos 6xx', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ code: 612, code_message: 'Nota não encontrada.', data: [] }),
    );

    expect(await fetchInvoiceByKey(NFCE_KEY)).toEqual({ status: 'not_found' });
  });

  it('propaga a mensagem da Infosimples em erro que não é 6xx', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ code: 401, code_message: 'Token inválido.', data: [] }),
    );

    expect(await fetchInvoiceByKey(NFCE_KEY)).toEqual({
      status: 'error',
      message: 'Token inválido.',
    });
  });

  it('rejeita resposta de NFC-e fora do formato esperado', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ code: 200, data: [{ emitente: { cnpj: '123' } }] }),
    );

    const outcome = await fetchInvoiceByKey(NFCE_KEY);

    expect(outcome).toMatchObject({ status: 'error' });
  });

  it('valida a chave antes de gastar consulta paga', async () => {
    const outcome = await fetchInvoiceByKey('123');

    expect(outcome).toMatchObject({ status: 'error' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('erra sem token configurado', async () => {
    vi.stubEnv('INFOSIMPLES_TOKEN', '');

    expect(isInfosimplesEnabled()).toBe(false);
    expect(await fetchInvoiceByKey(NFCE_KEY)).toEqual({
      status: 'error',
      message: 'Integração Infosimples não configurada.',
    });
  });
});
