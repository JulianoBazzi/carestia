import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoiceImport } from '~/app/invoices/import/components/import';
import { Provider } from '~/components/ui/provider';

const postMock = vi.hoisted(() => vi.fn());

vi.mock('~/services/apiClient', () => ({
  api: { post: postMock },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function importResponse(file: string) {
  return {
    data: {
      summary: { imported: 1, duplicated: 0, errors: 0 },
      results: [{ file, status: 'imported' as const }],
    },
  };
}

function xmlFile(name = 'nota.xml') {
  return new File(['<nfeProc />'], name, { type: 'text/xml' });
}

function renderImport() {
  const view = render(
    <Provider>
      <InvoiceImport />
    </Provider>,
  );
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error('input de arquivo não encontrado');
  }
  return { ...view, input };
}

describe('InvoiceImport — dropzone bloqueada durante importação', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    postMock.mockReset();
  });

  it('não abre o seletor nem aceita drop enquanto a importação roda', async () => {
    const pending = deferred<ReturnType<typeof importResponse>>();
    postMock.mockReturnValue(pending.promise);

    const { input } = renderImport();

    fireEvent.change(input, { target: { files: [xmlFile()] } });

    // Importação em andamento: input desabilitado e card em estado "ocupado".
    await waitFor(() => expect(input).toBeDisabled());
    const busyText = await screen.findByText('Importação em andamento…');
    expect(postMock).toHaveBeenCalledTimes(1);

    // Clique no card não pode abrir o seletor de arquivos.
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    fireEvent.click(busyText);
    expect(clickSpy).not.toHaveBeenCalled();

    // Drop de novos arquivos é ignorado (nenhum novo POST).
    fireEvent.drop(busyText, { dataTransfer: { files: [xmlFile('outra.xml')] } });
    expect(postMock).toHaveBeenCalledTimes(1);

    // Ao terminar, a dropzone volta ao normal e o clique reabre o seletor.
    pending.resolve(importResponse('nota.xml'));
    await waitFor(() => expect(input).not.toBeDisabled());
    const idleText = await screen.findByText('Arraste seus arquivos aqui');

    fireEvent.click(idleText);
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('InvoiceImport — envio em lotes (chunks)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    postMock.mockReset();
  });

  // Responde 'imported' para cada arquivo recebido, na ordem enviada.
  function respondPerFile() {
    postMock.mockImplementation((_url: string, form: FormData) => {
      const files = form.getAll('file') as File[];
      return Promise.resolve({
        data: {
          summary: { imported: files.length, duplicated: 0, errors: 0 },
          results: files.map((f) => ({ file: f.name, status: 'imported' as const })),
        },
      });
    });
  }

  it('agrupa vários XMLs num único POST e mapeia os resultados por índice', async () => {
    respondPerFile();
    const { input } = renderImport();

    fireEvent.change(input, {
      target: { files: [xmlFile('a.xml'), xmlFile('b.xml'), xmlFile('c.xml')] },
    });

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const form = postMock.mock.calls[0][1] as FormData;
    expect(form.getAll('file')).toHaveLength(3);
    await waitFor(() => expect(screen.getAllByText('Importada')).toHaveLength(3));
  });

  it('divide em mais de um POST acima do tamanho do chunk', async () => {
    respondPerFile();
    const { input } = renderImport();

    // 11 arquivos com chunk de 10 → dois POSTs (10 + 1).
    const files = Array.from({ length: 11 }, (_, i) => xmlFile(`nota-${i}.xml`));
    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    const sizes = postMock.mock.calls
      .map((call) => (call[1] as FormData).getAll('file').length)
      .sort((a, b) => a - b);
    expect(sizes).toEqual([1, 10]);
    await waitFor(() => expect(screen.getAllByText('Importada')).toHaveLength(11));
  });

  it('falha do request marca todas as entradas do chunk como erro', async () => {
    postMock.mockRejectedValue({ response: { data: { error: 'Muitas requisições.' } } });
    const { input } = renderImport();

    fireEvent.change(input, { target: { files: [xmlFile('a.xml'), xmlFile('b.xml')] } });

    await waitFor(() => expect(screen.getAllByText('Erro')).toHaveLength(2));
    expect(screen.getAllByText('Muitas requisições.')).toHaveLength(2);
  });
});
