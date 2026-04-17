"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = void 0;
const sequelize_1 = require("sequelize");
const sequelize_config_1 = require("../../../config/sequelize.config");
// Tag Sequelize model.
//
// Source: taggit.models.Tag (django-taggit)
//
// django-taggit used a shared Tag table with TaggedItem junction.
// In the target we use explicit Tag + ArticleTag tables (redesign TM-taggit).
//
// BR-026: tag names are normalised to lowercase on insertion (taggit behaviour).
class Tag extends sequelize_1.Model {
}
exports.Tag = Tag;
Tag.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'tags',
    timestamps: false,
});
