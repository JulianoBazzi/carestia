import { z } from 'zod';

/**
 * Contrato da resposta da Infosimples para a consulta de NFC-e (`sefaz-nfce`).
 *
 * Diferente da NF-e, a NFC-e NÃO devolve `url_xml` — os dados só existem neste
 * JSON. E o portal da SEFAZ não expõe NCM nem GTIN por item: o único código de
 * produto é o `codigo` interno do emitente (inútil como identidade global, ver
 * `infosimples-nfce.ts`).
 *
 * Deliberadamente tolerante: campos que não usamos ficam de fora (o Zod os
 * descarta) e os que usamos aceitam string OU número, porque o formato varia
 * entre as UFs por trás do endpoint unificado.
 */

/** Campo que chega ora como string ("529"), ora como número (529). */
const looseText = z.union([z.string(), z.number()]).nullish();

export const infosimplesNfceProductSchema = z.object({
  codigo: looseText,
  nome: z.string(),
  unidade: looseText,
  quantidade: looseText,
  valor_unitario: looseText,
  valor_total_produto: looseText,
  // Versões já convertidas para número pela Infosimples; usadas só como fallback
  // (perdem precisão em relação às strings pt-BR acima).
  normalizado_valor_unitario: z.number().nullish(),
  normalizado_valor_total_produto: z.number().nullish(),
});

export const infosimplesNfceSchema = z.object({
  cancelada: z.boolean().nullish(),
  emitente: z.object({
    cnpj: z.string(),
    nome_razao_social: z.string().nullish(),
    // Endereço vem num texto único, sem campos separados — ver `parseAddressTail`.
    endereco: z.string().nullish(),
  }),
  informacoes_nota: z.object({
    chave_acesso: z.string(),
    data_emissao: looseText,
    data_autorizacao: looseText,
    hora_emissao: looseText,
    numero: looseText,
    serie: looseText,
  }),
  produtos: z.array(infosimplesNfceProductSchema),
});

export type InfosimplesNfce = z.infer<typeof infosimplesNfceSchema>;
export type InfosimplesNfceProduct = z.infer<typeof infosimplesNfceProductSchema>;
