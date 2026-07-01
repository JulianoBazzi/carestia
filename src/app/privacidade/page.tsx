import type { Metadata } from 'next';
import { LegalLayout, LegalSection } from '~/components/public/LegalLayout';

export const metadata: Metadata = { title: 'Política de Privacidade' };

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="29/06/2026">
      <LegalSection title="Nosso princípio: privacy-first">
        Guardamos o mínimo necessário para acompanhar preços. De cada nota mantemos apenas o
        emitente, o preço unitário de cada item e o bairro/cidade/UF da compra ou consumo.
      </LegalSection>
      <LegalSection title="O que NÃO armazenamos">
        Descartamos CPF, nome e endereço completo do consumidor; o total da nota e a quantidade de
        cada item; e o XML original. Em contas de energia, descartamos também unidade consumidora,
        número do medidor, titular e o consumo em kWh — guardamos só a distribuidora e o preço por
        kWh.
      </LegalSection>
      <LegalSection title="Dados de conta">
        Para autenticação, armazenamos seu nome, e-mail e uma versão criptografada (hash) da sua
        senha.
      </LegalSection>
      <LegalSection title="Uso agregado e anônimo">
        Os preços unitários podem ser combinados em índices regionais médios, exibidos publicamente
        sem qualquer identificação do usuário ou da nota. Aplicamos um mínimo de amostras por
        agregação.
      </LegalSection>
      <LegalSection title="Seus direitos">
        Você pode excluir suas notas e sua conta a qualquer momento, removendo seus dados pessoais
        do serviço.
      </LegalSection>
    </LegalLayout>
  );
}
