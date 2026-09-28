import type { Metadata } from 'next';
import { LegalLayout, LegalSection } from '~/components/public/LegalLayout';

// Dinâmica: REGISTRATION_OPEN é lido em runtime (estática, a flag congelaria no build).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Política de Privacidade' };

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="27/09/2026">
      <LegalSection title="Nosso princípio: privacy-first">
        Guardamos o mínimo necessário para acompanhar preços. De cada nota mantemos apenas o
        emitente, o preço unitário de cada item, o bairro/cidade/UF da compra ou consumo e, quando a
        nota informa, o valor aproximado dos tributos por unidade daquele item (o número exigido
        pela Lei 12.741/2012, convertido para "por unidade" antes de ser gravado).
      </LegalSection>
      <LegalSection title="O que NÃO armazenamos">
        Descartamos CPF, nome e endereço completo do consumidor; o total da nota, o total de
        tributos de cada linha e a quantidade de cada item; e o XML original. Em contas de energia,
        descartamos também unidade consumidora, número do medidor, titular e o consumo em kWh —
        guardamos só a distribuidora e o preço por kWh.
      </LegalSection>
      <LegalSection title="Dados de conta">
        Para autenticação, armazenamos seu nome, e-mail e uma versão criptografada (hash) da sua
        senha.
      </LegalSection>
      <LegalSection title="Scanner: etiquetas, localização e câmera">
        No Scanner, a câmera é usada só no seu aparelho para ler o código de barras ou o QR code —
        nenhum vídeo é enviado. Ao fotografar uma etiqueta de preço, a foto é enviada a um serviço
        de inteligência artificial (OpenAI) apenas para a leitura do código, do preço e do nome do
        produto, e não é armazenada por nós. Do preço que você registra guardamos o produto, o preço
        unitário e a cidade/UF, além do vínculo com a sua conta — usado só para evitar abuso e
        moderar registros, e nunca exibido nem usado nos índices públicos. Em navegadores sem leitor
        de código de barras nativo (como Safari no iPhone e Firefox), o componente de leitura é
        baixado de uma rede de distribuição pública (jsDelivr), que recebe apenas a requisição do
        arquivo. Sua localização, quando você a compartilha, é arredondada no próprio aparelho e
        serve apenas para descobrir em qual cidade você está: as coordenadas nunca são gravadas — o
        navegador guarda só a cidade e a UF.
      </LegalSection>
      <LegalSection title="Uso agregado e anônimo">
        Os preços unitários — das notas fiscais e das etiquetas registradas no Scanner — são
        combinados em índices regionais médios, exibidos publicamente sem qualquer identificação do
        usuário ou da nota. Não há como ligar um preço publicado a uma conta.
      </LegalSection>
      <LegalSection title="Seus direitos">
        Você pode excluir suas notas e sua conta a qualquer momento. Ao excluir a conta, seu nome,
        e-mail e senha são apagados e o e-mail fica livre para um novo cadastro. Os preços unitários
        que você já enviou permanecem nos índices, sem nada que os ligue a você.
      </LegalSection>
    </LegalLayout>
  );
}
