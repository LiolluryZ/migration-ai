import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

// Tag Sequelize model.
//
// Source: taggit.models.Tag (django-taggit)
//
// django-taggit used a shared Tag table with TaggedItem junction.
// In the target we use explicit Tag + ArticleTag tables (redesign TM-taggit).
//
// BR-026: tag names are normalised to lowercase on insertion (taggit behaviour).

export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  declare id: CreationOptional<number>;
  // BR-026: stored lowercase; normalisation applied in ArticleTag creation
  declare name: string;
  // taggit stores a slug alongside the name (identical for lowercase-normalised tags)
  declare slug: CreationOptional<string>;
}

Tag.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    // allowNull: true so beforeCreate validation passes before the hook sets it
    slug: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'taggit_tag',
    timestamps: false,
    hooks: {
      beforeCreate(tag) {
        if (!tag.slug) {
          tag.slug = tag.name;
        }
      },
    },
  },
);
