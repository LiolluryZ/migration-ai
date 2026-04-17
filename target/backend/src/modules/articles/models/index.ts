// Models barrel — exports all article-domain models and wires associations.
//
// Associations mirror Django's implicit ORM relations:
//   Article.author     → ForeignKey(AUTH_USER_MODEL, on_delete=CASCADE)
//   Article.tags       → TaggableManager (via ArticleTag junction)
//   Article.favorites  → ManyToManyField(AUTH_USER_MODEL) (via Favorite junction)
//
// Sprint 3 (accounts): replace UserStub import with the real User model.

export { Article } from './article.model';
export { Tag } from './tag.model';
export { ArticleTag } from './article-tag.model';
export { Favorite } from './favorite.model';
export { UserStub } from './user.stub';

import { Article } from './article.model';
import { Tag } from './tag.model';
import { ArticleTag } from './article-tag.model';
import { Favorite } from './favorite.model';
import { UserStub } from './user.stub';

// Article.author
Article.belongsTo(UserStub, { foreignKey: 'authorId', as: 'author' });
UserStub.hasMany(Article, { foreignKey: 'authorId', as: 'articles' });

// Article ↔ Tag (many-to-many via ArticleTag / taggit_taggeditem)
Article.belongsToMany(Tag, { through: ArticleTag, foreignKey: 'objectId', otherKey: 'tagId', as: 'tags' });
Tag.belongsToMany(Article, { through: ArticleTag, foreignKey: 'tagId', otherKey: 'objectId', as: 'articles' });

// Article ↔ User (favorites, many-to-many via Favorite)
Article.belongsToMany(UserStub, { through: Favorite, foreignKey: 'articleId', otherKey: 'userId', as: 'favoritedBy' });
UserStub.belongsToMany(Article, { through: Favorite, foreignKey: 'userId', otherKey: 'articleId', as: 'favorites' });

// Direct hasMany for COUNT queries
Article.hasMany(Favorite, { foreignKey: 'articleId', as: 'favoriteRecords' });
