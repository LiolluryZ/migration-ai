/**
 * Development seed script — Agent 19 validation setup.
 * Creates DB schema + test data matching legacy seed user.
 */
import 'dotenv/config';
import { sequelize } from '../src/config/sequelize.config';
import { Article, Tag, ArticleTag, Favorite, UserStub } from '../src/modules/articles/models';

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  console.log('DB synced.');

  const user = await UserStub.create({
    username: 'admin',
    bio: null,
    image: null,
  });
  console.log(`Created user: ${user.username} (id=${user.id})`);

  // Mirror the legacy article discovered by agent 13
  const article = await Article.create({
    title: 'Télétravail : bilan et nouvelles frontières du travail à distance',
    summary: 'Un regard approfondi sur l\'évolution du télétravail.',
    content: 'Le télétravail a profondément transformé les modes de travail.',
    authorId: user.id!,
  });
  console.log(`Created article: ${article.slug}`);

  // Add tag
  const tag = await Tag.findOrCreate({ where: { name: 'intelligence-artificielle' } });
  await ArticleTag.create({ articleId: article.id!, tagId: tag[0].id! });

  // Second article for list tests
  const article2 = await Article.create({
    title: 'Test Article for Validation',
    summary: 'Validation article summary.',
    content: 'Validation content body.',
    authorId: user.id!,
  });
  console.log(`Created article: ${article2.slug}`);

  console.log('\nSeed complete. User id:', user.id);
  console.log('Article slug:', article.slug);

  await sequelize.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
