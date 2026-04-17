// Accounts models barrel — exports User, Follower, and wires associations.
//
// BR-010: asymmetric follow relation:
//   from_user_id FOLLOWS to_user_id
//   User A follows User B → row { fromUserId: A.id, toUserId: B.id }
//
// NOTE: Article ↔ User associations (author, favorites) are declared in
//   articles/models/index.ts because the Article model lives in that module.
//   Defining them here would create a circular dependency.

export { User } from './user.model';
export { Follower } from './follower.model';

import { User } from './user.model';
import { Follower } from './follower.model';

// User → Follower associations (BR-010)
// "following" = rows where this user is the follower (from_user_id = this.id)
User.hasMany(Follower, { foreignKey: 'fromUserId', as: 'followingRecords' });
// "followers" = rows where this user is the followee (to_user_id = this.id)
User.hasMany(Follower, { foreignKey: 'toUserId', as: 'followerRecords' });
