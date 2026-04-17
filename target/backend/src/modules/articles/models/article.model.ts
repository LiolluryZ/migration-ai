import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
  type Association,
} from 'sequelize';
import slugify from 'slugify';
import { sequelize } from '../../../config/sequelize.config';

// Article Sequelize model.
//
// Source: apps/articles/models.py :: Article
//
// Field mapping (form ↔ model ↔ API):
//   form.title        → article.title      → response.title
//   form.description  → article.summary    → response.description   (BR-031)
//   form.body         → article.content    → response.body          (BR-031)
//
// BR-022: title unique, max 150 chars. summary and content are optional.
// BR-023: slug generated ONCE at creation via slugify(title). NEVER regenerated.
// BR-024: created (auto createdAt, indexed), updated (auto updatedAt).

export class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
  declare id: CreationOptional<number>;

  // BR-022: title unique, max 150 chars
  declare title: string;

  // BR-031: form.description → model.summary, form.body → model.content
  declare summary: CreationOptional<string>;
  declare content: CreationOptional<string>;

  // BR-023: slug generated once at creation; NEVER updated.
  declare slug: CreationOptional<string>;

  declare authorId: ForeignKey<number>;

  // BR-024: timestamps managed automatically by Sequelize
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations set up in models/index.ts
  declare author?: NonAttribute<{ id: number; username: string; bio: string | null; image: string | null }>;
  declare tags?: NonAttribute<import('./tag.model').Tag[]>;
  declare favorites?: NonAttribute<import('./favorite.model').Favorite[]>;
  declare favoriteRecords?: NonAttribute<import('./favorite.model').Favorite[]>;

  static associations: {
    author: Association;
    tags: Association;
    favorites: Association;
  };
}

Article.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true, // BR-022
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    // BR-023: slug generated at creation from title, never changes after that.
    // allowNull: true here because Sequelize validates BEFORE running the
    // beforeCreate hook. The hook always sets the slug; the DB unique constraint
    // ensures no two articles share the same slug.
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'author_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created',
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated',
    },
  },
  {
    sequelize,
    tableName: 'articles_article',
    indexes: [
      // BR-024: created is indexed for feed ordering (order_by('-created'))
      { fields: ['created'] },
    ],
    hooks: {
      // BR-023: generate slug from title on CREATE only (no pk yet).
      // Source: apps/articles/models.py :: Article.save() – if not self.pk: self.slug = slugify(self.title)
      async beforeCreate(article) {
        const base = slugify(article.title, { lower: true, strict: true });
        // Ensure uniqueness by appending a timestamp if needed.
        let candidate = base;
        const existing = await Article.findOne({ where: { slug: candidate } });
        if (existing) {
          candidate = `${base}-${Date.now()}`;
        }
        article.slug = candidate;
      },
    },
  },
);
