"use strict";
// Models barrel — exports all article-domain models and wires associations.
//
// Associations mirror Django's implicit ORM relations:
//   Article.author     → ForeignKey(AUTH_USER_MODEL, on_delete=CASCADE)
//   Article.tags       → TaggableManager (via ArticleTag junction)
//   Article.favorites  → ManyToManyField(AUTH_USER_MODEL) (via Favorite junction)
//
// Sprint 3 (accounts): replace UserStub import with the real User model.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStub = exports.Favorite = exports.ArticleTag = exports.Tag = exports.Article = void 0;
var article_model_1 = require("./article.model");
Object.defineProperty(exports, "Article", { enumerable: true, get: function () { return article_model_1.Article; } });
var tag_model_1 = require("./tag.model");
Object.defineProperty(exports, "Tag", { enumerable: true, get: function () { return tag_model_1.Tag; } });
var article_tag_model_1 = require("./article-tag.model");
Object.defineProperty(exports, "ArticleTag", { enumerable: true, get: function () { return article_tag_model_1.ArticleTag; } });
var favorite_model_1 = require("./favorite.model");
Object.defineProperty(exports, "Favorite", { enumerable: true, get: function () { return favorite_model_1.Favorite; } });
var user_stub_1 = require("./user.stub");
Object.defineProperty(exports, "UserStub", { enumerable: true, get: function () { return user_stub_1.UserStub; } });
const article_model_2 = require("./article.model");
const tag_model_2 = require("./tag.model");
const article_tag_model_2 = require("./article-tag.model");
const favorite_model_2 = require("./favorite.model");
const user_stub_2 = require("./user.stub");
// Article.author
article_model_2.Article.belongsTo(user_stub_2.UserStub, { foreignKey: 'authorId', as: 'author' });
user_stub_2.UserStub.hasMany(article_model_2.Article, { foreignKey: 'authorId', as: 'articles' });
// Article ↔ Tag (many-to-many via ArticleTag)
article_model_2.Article.belongsToMany(tag_model_2.Tag, { through: article_tag_model_2.ArticleTag, foreignKey: 'articleId', otherKey: 'tagId', as: 'tags' });
tag_model_2.Tag.belongsToMany(article_model_2.Article, { through: article_tag_model_2.ArticleTag, foreignKey: 'tagId', otherKey: 'articleId', as: 'articles' });
// Article ↔ User (favorites, many-to-many via Favorite)
article_model_2.Article.belongsToMany(user_stub_2.UserStub, { through: favorite_model_2.Favorite, foreignKey: 'articleId', otherKey: 'userId', as: 'favoritedBy' });
user_stub_2.UserStub.belongsToMany(article_model_2.Article, { through: favorite_model_2.Favorite, foreignKey: 'userId', otherKey: 'articleId', as: 'favorites' });
// Direct hasMany for COUNT queries
article_model_2.Article.hasMany(favorite_model_2.Favorite, { foreignKey: 'articleId', as: 'favoriteRecords' });
