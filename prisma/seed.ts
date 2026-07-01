import 'dotenv/config';
import { DEFAULT_CATEGORIES } from '~/lib/categories';
import { newId } from '~/lib/id';
import prisma from '~/lib/prisma';

async function main() {
  // Categorias padrão (idempotente por slug). É tudo que o seed cria.
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { id: newId(), name: cat.name, slug: cat.slug },
      update: { name: cat.name },
    });
  }
  console.log(`✔ ${DEFAULT_CATEGORIES.length} categorias`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
