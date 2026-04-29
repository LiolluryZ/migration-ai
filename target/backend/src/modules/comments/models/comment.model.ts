import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type NonAttribute,
} from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

// Comment Sequelize model.
//
// Source: apps/comments/models.py :: Comment
//
// Field mapping (model ↔ DB column):
//   content        → content
//   articleId      → article_id (FK → articles_article.id)
//   authorId       → author_id  (FK → accounts_user.id)
//   createdAt      → created    (auto, indexed)
//   updatedAt      → updated    (auto)
//
// BR-039: content is required and non-empty (enforced at route level).
// BR-042: CASCADE delete wired in models/index.ts (Article.hasMany + hooks:true).
// BR-043: created is indexed for anti-chronological ordering.
//
// Retrocompatibility REQUIRED: tableName = 'comments_comment'.

export class Comment extends Model<InferAttributes<Comment>, InferCreationAttributes<Comment>> {
  declare id: CreationOptional<number>;

  // BR-039: content is non-nullable/non-empty (validated before insert)
  declare content: string;

  declare articleId: ForeignKey<number>;
  declare authorId: ForeignKey<number>;

  // BR-043: createdAt mapped to 'created' column (indexed)
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Association set up in comments/models/index.ts
  declare author?: NonAttribute<{ id: number; username: string; bio: string | null; image: string | null }>;
}

Comment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    articleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'article_id',
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
    tableName: 'comments_comment',
    indexes: [
      // BR-043: created indexed for ORDER BY created DESC
      { fields: ['created'] },
    ],
  },
);
