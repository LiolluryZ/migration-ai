"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArticleTag = void 0;
const sequelize_1 = require("sequelize");
const sequelize_config_1 = require("../../../config/sequelize.config");
// ArticleTag junction table — replaces django-taggit's TaggedItem.
//
// Source: taggit.models.TaggedItem (many-to-many via ContentType)
// Redesign: TM-taggit — explicit Article ↔ Tag many-to-many table.
//
// BR-026: tag names are normalised to lowercase BEFORE inserting this record.
//   The normalisation is applied in the route handler before findOrCreate on Tag,
//   matching django-taggit's automatic lowercase behaviour.
class ArticleTag extends sequelize_1.Model {
}
exports.ArticleTag = ArticleTag;
ArticleTag.init({
    articleId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'articles', key: 'id' },
    },
    tagId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'tags', key: 'id' },
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'article_tags',
    timestamps: false,
});
