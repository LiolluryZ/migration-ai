"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Favorite = void 0;
const sequelize_1 = require("sequelize");
const sequelize_config_1 = require("../../../config/sequelize.config");
// Favorite junction table — replaces Django's Article.favorites ManyToManyField.
//
// Source: apps/articles/models.py ::
//   favorites = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='favorites')
//
// BR-036: Favorite is a toggle (add / remove). Author can favourite their own article.
// BR-025 (counter): favoritesCount on Article is computed by COUNT on this table,
//   never cached. A re-query after toggle returns the fresh count.
class Favorite extends sequelize_1.Model {
}
exports.Favorite = Favorite;
Favorite.init({
    userId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
    },
    articleId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'articles', key: 'id' },
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'favorites',
    timestamps: false,
});
