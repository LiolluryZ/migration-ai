import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type ForeignKey, type CreationOptional } from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

// Favorite junction table — maps to Django's articles_article_favorites table.
//
// Source: apps/articles/models.py ::
//   favorites = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='favorites')
//
// BR-036: Favorite is a toggle (add / remove). Author can favourite their own article.
// BR-025 (counter): favoritesCount on Article is computed by COUNT on this table,
//   never cached. A re-query after toggle returns the fresh count.

export class Favorite extends Model<InferAttributes<Favorite>, InferCreationAttributes<Favorite>> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<number>;
  declare articleId: ForeignKey<number>;
}

Favorite.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: { model: 'accounts_user', key: 'id' },
    },
    articleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'article_id',
      references: { model: 'articles_article', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'articles_article_favorites',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['user_id', 'article_id'] },
    ],
  },
);
