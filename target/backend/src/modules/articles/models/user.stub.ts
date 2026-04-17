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

import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

export class UserStub extends Model<InferAttributes<UserStub>, InferCreationAttributes<UserStub>> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare bio: CreationOptional<string | null>;
  declare image: CreationOptional<string | null>;
}

UserStub.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    image: {
      type: DataTypes.STRING(512),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'accounts_user',
    timestamps: false,
  },
);
