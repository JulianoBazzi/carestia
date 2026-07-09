import { config } from 'dotenv';
import { DEFAULT_CATEGORIES } from '~/lib/categories';
import { newId } from '~/lib/id';

// O `tsx` roda este seed direto (sem passar pelo prisma.config.ts) e não carrega
// `.env.local` sozinho. Carregamos aqui ANTES de importar o client do Prisma —
// que lê DATABASE_URL no momento do import. `.env.local` tem prioridade; `.env`
// (se existir) fica como fallback.
config({ path: '.env.local' });
config();

async function main() {
  // Import dinâmico: garante que a DATABASE_URL já foi carregada acima antes de
  // o client do Prisma inicializar o adapter.
  const { default: prisma } = await import('~/lib/prisma');

  try {
    // Categorias padrão (idempotente por slug). É tudo que o seed cria.
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        create: { id: newId(), name: cat.name, slug: cat.slug },
        update: { name: cat.name },
      });
    }
    console.log(`✔ ${DEFAULT_CATEGORIES.length} categorias`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
