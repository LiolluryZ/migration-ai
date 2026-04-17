"use strict";
// User stub model — minimal representation needed for Article ↔ author FK.
//
// Sprint 3 (accounts module) will replace this stub with the full User model
// (email, password hash, bio, image, followers M2M).
//
// This file will be DELETED and replaced by:
//   target/backend/src/modules/accounts/models/user.model.ts
//
// The association declarations in models/index.ts reference `UserStub` by name
// so the only change required in Sprint 3 is to swap the import.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStub = void 0;
const sequelize_1 = require("sequelize");
const sequelize_config_1 = require("../../../config/sequelize.config");
class UserStub extends sequelize_1.Model {
}
exports.UserStub = UserStub;
UserStub.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    username: {
        type: sequelize_1.DataTypes.STRING(150),
        allowNull: false,
        unique: true,
    },
    bio: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
    image: {
        type: sequelize_1.DataTypes.STRING(512),
        allowNull: true,
        defaultValue: null,
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'users',
    timestamps: false,
});
