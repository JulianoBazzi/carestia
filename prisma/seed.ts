import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword } from '~/lib/auth/password';
import { DEFAULT_CATEGORIES } from '~/lib/categories';
import { newId } from '~/lib/id';
import prisma from '~/lib/prisma';
import { importInvoice } from '~/services/invoice/import';

const DEMO_EMAIL = 'demo@minhainflacao.app';
const DEMO_PASSWORD = 'demo123';

async function main() {
  // Categorias padrão (idempotente por slug)
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { id: newId(), name: cat.name, slug: cat.slug },
      update: { name: cat.name },
    });
  }
  console.log(`✔ ${DEFAULT_CATEGORIES.length} categorias`);

  // Usuário demo
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      id: newId(),
      name: 'Usuário Demo',
      email: DEMO_EMAIL,
      password: await hashPassword(DEMO_PASSWORD),
    },
    update: {},
  });
  console.log(`✔ usuário demo (${DEMO_EMAIL} / ${DEMO_PASSWORD})`);

  // Importa as notas de exemplo
  const fixtures = join(__dirname, '../src/services/invoice/__fixtures__');
  const xmls = readdirSync(fixtures).filter((f) => f.endsWith('.xml'));
  const seen = new Set<string>();
  let imported = 0;
  for (const file of xmls) {
    const xml = readFileSync(join(fixtures, file), 'utf-8');
    const result = await importInvoice(user.id, xml, seen);
    if (result.status === 'imported') imported++;
  }
  console.log(`✔ ${imported} nota(s) importada(s) de ${xmls.length} fixture(s)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
