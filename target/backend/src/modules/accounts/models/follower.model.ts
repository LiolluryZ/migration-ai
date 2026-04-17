import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';

// Follower junction table — accounts_user_followers.
//
// Source: apps/accounts/models.py ::
//   followers = models.ManyToManyField('self', blank=True, symmetrical=False)
//
// BR-010: asymmetric follow relation (A follows B ≠ B follows A).
//   Row semantics: from_user_id FOLLOWS to_user_id.
//   i.e. "from_user_id" is in "to_user_id.followers" Django set.
//
// is_following(self=A, other_user=B) :=
//   B.followers.filter(pk=A.id).exists()
//   → row { from_user_id: A.id, to_user_id: B.id } exists
//
// Unique constraint (from_user_id, to_user_id) mirrors Django M2M uniqueness.
//
// Retrocompatibility REQUIRED: tableName = 'accounts_user_followers'.
// timestamps: false — no timestamps in this junction table.

export class Follower extends Model<
  InferAttributes<Follower>,
  InferCreationAttributes<Follower>
> {
  declare id: CreationOptional<number>;
  // from_user_id: the follower (who is following)
  declare fromUserId: number;
  // to_user_id: the followee (who is being followed)
  declare toUserId: number;
}

Follower.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    fromUserId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'from_user_id',
      references: { model: 'accounts_user', key: 'id' },
    },
    toUserId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'to_user_id',
      references: { model: 'accounts_user', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'accounts_user_followers',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['from_user_id', 'to_user_id'],
        name: 'accounts_user_followers_from_to_uniq',
      },
    ],
  },
);
