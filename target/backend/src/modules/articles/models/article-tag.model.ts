import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type ForeignKey, type CreationOptional } from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

// ArticleTag junction table — maps to django-taggit's TaggedItem.
//
// Source: taggit.models.TaggedItem
// Table: taggit_taggeditem
// content_type_id = 9 corresponds to articles.article in django_content_type.
//
// BR-026: tag names are normalised to lowercase BEFORE inserting this record.
//   The normalisation is applied in the route handler before findOrCreate on Tag,
//   matching django-taggit's automatic lowercase behaviour.

export class ArticleTag extends Model<InferAttributes<ArticleTag>, InferCreationAttributes<ArticleTag>> {
  declare id: CreationOptional<number>;
  declare objectId: ForeignKey<number>;              // maps to object_id (article.id)
  declare contentTypeId: CreationOptional<number>;   // maps to content_type_id (always 9 for articles)
  declare tagId: ForeignKey<number>;                 // maps to tag_id
}

ArticleTag.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    objectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'object_id',
      references: { model: 'articles_article', key: 'id' },
    },
    contentTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 9,
      field: 'content_type_id',
    },
    tagId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tag_id',
      references: { model: 'taggit_tag', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'taggit_taggeditem',
    timestamps: false,
  },
);
