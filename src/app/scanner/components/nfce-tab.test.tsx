import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('~/services/apiClient', () => ({ api: { post: postMock, get: vi.fn() } }));

// A câmera real não existe no jsdom: o visor vira um botão que "lê" o código
// informado no teste.
let nextScan = '';
vi.mock('~/app/scanner/components/camera-scanner', () => ({
  CameraScanner: ({
    onDetected,
  }: {
    onDetected: (c: { rawValue: string; format: string }) => void;
  }) => (
    <button type="button" onClick={() => onDetected({ rawValue: nextScan, format: 'qr_code' })}>
      simular leitura
    </button>
  ),
}));

import { NfceTab } from '~/app/scanner/components/nfce-tab';
import { Provider } from '~/components/ui/provider';

// Chave NFC-e (modelo 65) com dígito verificador válido.
const KEY = '65260612345678000199650010000000011000000010';
const QR = `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${KEY}|2|1|1|ABCDEF`;

function renderTab(props: { loggedIn?: boolean; enabled?: boolean } = {}) {
  return render(
    <Provider>
      <NfceTab
        loggedIn={props.loggedIn ?? true}
        enabled={props.enabled ?? true}
        registrationOpen={false}
      />
    </Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nextScan = QR;
});

describe('NfceTab', () => {
  it('extrai a chave do QR code e importa a nota', async () => {
    postMock.mockResolvedValue({ data: { results: [{ key: KEY, status: 'imported' }] } });
    renderTab();

    fireEvent.click(screen.getByText('simular leitura'));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/invoices/import-key', { keys: [KEY] });
    });
    expect(await screen.findByText('Importada')).toBeInTheDocument();
    expect(screen.getByText(KEY)).toBeInTheDocument();
  });

  it('não reenvia o mesmo cupom lido duas vezes', async () => {
    postMock.mockResolvedValue({ data: { results: [{ key: KEY, status: 'duplicated' }] } });
    renderTab();

    fireEvent.click(screen.getByText('simular leitura'));
    expect(await screen.findByText('Já importada')).toBeInTheDocument();

    fireEvent.click(screen.getByText('simular leitura'));
    expect(await screen.findByText('Cupom já lido')).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('avisa e não consulta quando o código lido não tem chave de acesso', async () => {
    nextScan = 'https://exemplo.com/promo';
    renderTab();

    fireEvent.click(screen.getByText('simular leitura'));

    expect(await screen.findByText('Código não reconhecido')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('mostra a mensagem do servidor quando a importação falha (ex.: cota)', async () => {
    postMock.mockRejectedValue({
      response: { data: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' } },
    });
    renderTab();

    fireEvent.click(screen.getByText('simular leitura'));

    expect(await screen.findByText('Erro')).toBeInTheDocument();
    expect(screen.getByText(/Muitas requisições/)).toBeInTheDocument();
  });

  it('retry após erro substitui a linha em vez de duplicar a chave', async () => {
    postMock
      .mockRejectedValueOnce({ response: { status: 500, data: { error: 'Falhou' } } })
      .mockResolvedValueOnce({ data: { results: [{ key: KEY, status: 'imported' }] } });
    renderTab();

    fireEvent.click(screen.getByText('simular leitura'));
    expect(await screen.findByText('Erro')).toBeInTheDocument();

    fireEvent.click(screen.getByText('simular leitura'));
    expect(await screen.findByText('Importada')).toBeInTheDocument();
    expect(screen.getAllByText(KEY)).toHaveLength(1);
  });

  it('avisa sessão expirada no 401', async () => {
    postMock.mockRejectedValue({
      response: { status: 401, data: { message: 'Não autenticado.' } },
    });
    renderTab();

    fireEvent.click(screen.getByText('simular leitura'));

    expect(await screen.findByText(/sessão expirou/)).toBeInTheDocument();
  });

  it('pede login quando o usuário é anônimo', () => {
    renderTab({ loggedIn: false });
    expect(screen.getByText('Entrar')).toBeInTheDocument();
    expect(screen.queryByText('simular leitura')).not.toBeInTheDocument();
  });

  it('avisa quando a integração está desligada no servidor', () => {
    renderTab({ enabled: false });
    expect(screen.getByText(/indisponível no momento/)).toBeInTheDocument();
    expect(screen.queryByText('simular leitura')).not.toBeInTheDocument();
  });
});
