import { config } from 'dotenv';
import { hashPassword } from '~/lib/auth/password';
import { DEFAULT_CATEGORIES } from '~/lib/categories';
import { newId } from '~/lib/id';

// O `tsx` roda este seed direto (sem passar pelo prisma.config.ts) e não carrega
// `.env.local` sozinho. Carregamos aqui ANTES de importar o client do Prisma —
// que lê DATABASE_URL no momento do import. `.env.local` tem prioridade; `.env`
// (se existir) fica como fallback.
config({ path: '.env.local', quiet: true });
config({ quiet: true });

// Usuário admin (o cadastro público pode estar fechado — ver REGISTRATION_OPEN).
// Vem do ambiente para que nenhuma credencial fique versionada. Sem as três
// variáveis, o seed cria só as categorias.
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

async function main() {
  // Import dinâmico: garante que a DATABASE_URL já foi carregada acima antes de
  // o client do Prisma inicializar o adapter.
  const { default: prisma } = await import('~/lib/prisma');

  try {
    // Garante a extensão de similaridade (pg_trgm) usada na deduplicação de itens
    // na importação (word_similarity em item-matching.ts). Idempotente.
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('✔ extensão pg_trgm');

    // Categorias padrão (idempotente por slug).
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        create: {
          id: newId(),
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          color: cat.color,
        },
        update: { name: cat.name },
      });
      // Backfill só do que está vazio: o seed nunca sobrescreve o ícone/cor que
      // o admin escolheu na tela de Categorias.
      await prisma.category.updateMany({
        where: { slug: cat.slug, icon: null },
        data: { icon: cat.icon },
      });
      await prisma.category.updateMany({
        where: { slug: cat.slug, color: null },
        data: { color: cat.color },
      });
    }
    console.log(`✔ ${DEFAULT_CATEGORIES.length} categorias`);

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.log('⚠ ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD ausentes — admin não criado');
      return;
    }
    if (ADMIN_PASSWORD.length < 12) {
      throw new Error('ADMIN_PASSWORD precisa ter ao menos 12 caracteres.');
    }

    // O seed é a fonte da verdade do admin: define nome e senha (bcrypt) por e-mail.
    const password = await hashPassword(ADMIN_PASSWORD);
    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      create: {
        id: newId(),
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password,
        type: 'admin',
        active: true,
      },
      update: { name: ADMIN_NAME, password, type: 'admin', active: true },
    });
    console.log(`✔ usuário admin (${ADMIN_EMAIL})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
