import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

// User model — full accounts_user table.
//
// Source: apps/accounts/models.py :: User(AbstractUser)
//
// BR-007: email is the login identifier (USERNAME_FIELD = 'email'), unique, required.
//         username is a display field, unique, max_length=60.
// BR-008: first_name and last_name removed — not stored, not in this table.
// BR-009: bio is optional free text (blank=True → empty string default, not null).
//         image is an optional URL (null=True, blank=True).
// BR-010: followers M2M (asymmetric) → see Follower junction model.
//
// HV-002 (RESOLVED): password column stores Django PBKDF2 hashes as-is.
//   Format: pbkdf2_sha256$<iterations>$<salt>$<hash_base64>
//   Max length 128 chars (Django AbstractUser default).
//
// Retrocompatibility REQUIRED: tableName = 'accounts_user' (Django migration).
// timestamps: false — Django manages date_joined manually, no Sequelize timestamps.

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare password: string;
  declare lastLogin: CreationOptional<Date | null>;
  declare isSuperuser: CreationOptional<boolean>;
  declare isStaff: CreationOptional<boolean>;
  declare isActive: CreationOptional<boolean>;
  declare dateJoined: CreationOptional<Date>;
  // BR-007: email is unique, used as login identifier
  declare email: string;
  // BR-007: username unique, max 60 chars
  declare username: string;
  // BR-009: bio is text, blank=True → never null (default '')
  declare bio: CreationOptional<string>;
  // BR-009: image is optional URL, null=True
  declare image: CreationOptional<string | null>;
}

User.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    // HV-002: stores Django-format PBKDF2 hash — see helpers/password.ts
    password: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: 'last_login',
    },
    isSuperuser: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_superuser',
    },
    isStaff: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_staff',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    dateJoined: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'date_joined',
    },
    // BR-007: email unique, max 254 (RFC 5321)
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
    },
    // BR-007: username unique, max 60 chars (Django CharField)
    username: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    // BR-009: bio blank=True → NOT NULL, defaultValue ''
    bio: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    // BR-009: image null=True, blank=True → nullable URL up to 200 chars (URLField default)
    image: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'accounts_user',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['username'] },
    ],
  },
);
