"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Article = void 0;
const sequelize_1 = require("sequelize");
const slugify_1 = __importDefault(require("slugify"));
const sequelize_config_1 = require("../../../config/sequelize.config");
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
class Article extends sequelize_1.Model {
    static associations;
}
exports.Article = Article;
Article.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: sequelize_1.DataTypes.STRING(150),
        allowNull: false,
        unique: true, // BR-022
    },
    summary: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
    },
    content: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
    },
    // BR-023: slug generated at creation from title, never changes after that.
    // allowNull: true here because Sequelize validates BEFORE running the
    // beforeCreate hook. The hook always sets the slug; the DB unique constraint
    // ensures no two articles share the same slug.
    slug: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: true,
        unique: true,
    },
    authorId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'articles',
    indexes: [
        // BR-024: created is indexed for feed ordering (order_by('-created'))
        { fields: ['createdAt'] },
    ],
    hooks: {
        // BR-023: generate slug from title on CREATE only (no pk yet).
        // Source: apps/articles/models.py :: Article.save() – if not self.pk: self.slug = slugify(self.title)
        async beforeCreate(article) {
            const base = (0, slugify_1.default)(article.title, { lower: true, strict: true });
            // Ensure uniqueness by appending a timestamp if needed.
            let candidate = base;
            const existing = await Article.findOne({ where: { slug: candidate } });
            if (existing) {
                candidate = `${base}-${Date.now()}`;
            }
            article.slug = candidate;
        },
    },
});
