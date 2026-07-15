import type { Metadata } from 'next';
import { LegalLayout, LegalSection } from '~/components/public/LegalLayout';

export const metadata: Metadata = { title: 'Termos de Uso' };

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" updatedAt="29/06/2026">
      <LegalSection title="1. Objeto">
        A Carestia é um serviço gratuito que permite ao usuário importar suas notas fiscais (NF-e,
        NFC-e, NFS-e e contas de energia/NF3e) para acompanhar a evolução dos preços que paga e
        compará-la ao IPCA oficial.
      </LegalSection>
      <LegalSection title="2. Cadastro">
        O acesso às funcionalidades pessoais exige cadastro com e-mail e senha. Você é responsável
        por manter a confidencialidade das suas credenciais.
      </LegalSection>
      <LegalSection title="3. Uso dos dados das notas">
        Ao importar uma nota, extraímos e armazenamos apenas o emitente, o preço unitário de cada
        item e o bairro/cidade/UF da compra ou consumo. Dados pessoais do consumidor são descartados
        — veja a Política de Privacidade.
      </LegalSection>
      <LegalSection title="4. Índice regional anônimo">
        Os preços unitários podem compor índices regionais agregados e anonimizados, exibidos
        publicamente, sem identificar usuários ou notas individuais.
      </LegalSection>
      <LegalSection title="5. Limitação de responsabilidade">
        O serviço é fornecido "como está". Os índices têm caráter informativo e não constituem
        aconselhamento financeiro.
      </LegalSection>
    </LegalLayout>
  );
}
