/**
 * Papel de administrador. A fonte da verdade é a coluna `users.type` ('admin' |
 * 'user'), carregada no JWT (`session.type`) — a checagem não toca o banco e
 * funciona no proxy (Node.js). Recursos restritos: importação por chave
 * (Infosimples), categorização por IA (OpenAI) e exclusão/mesclagem do catálogo
 * global (empresas, categorias, itens).
 */
export function isAdmin(session: { type?: string | null } | null | undefined): boolean {
  return session?.type === 'admin';
}
