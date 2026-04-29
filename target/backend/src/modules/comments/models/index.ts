// Comments barrel — exports Comment and wires associations with Article and User.
//
// Source: apps/comments/models.py
//   Comment.article → ForeignKey(Article, on_delete=CASCADE)  (BR-042)
//   Comment.author  → ForeignKey(AUTH_USER_MODEL, on_delete=CASCADE)
//
// Import from the articles barrel FIRST so that Article + UserStub models are
// already initialised and their own associations (Article↔User, Article↔Tag…)
// are wired before we add Comment's associations on top.
//
// BR-042: Article.hasMany(Comment, hooks:true) triggers Sequelize JS-level
// cascade when article.destroy() is called (works for both SQLite and PG).

export { Comment } from './comment.model';

import { Comment } from './comment.model';

// Chain through the articles barrel to guarantee Article and UserStub are
// registered with the shared Sequelize instance before we add associations.
import { Article, UserStub } from '../../articles/models/index';

// Comment → Article (many-to-one)
Comment.belongsTo(Article, { foreignKey: 'articleId', as: 'article' });

// Article → Comment (one-to-many + cascade)
// BR-042: hooks:true ensures comment rows are destroyed via Sequelize when
//   article.destroy() is called (used in DELETE /api/articles/:slug).
Article.hasMany(Comment, {
  foreignKey: 'articleId',
  as: 'comments',
  onDelete: 'CASCADE',
  hooks: true,
});

// Comment → User (author, many-to-one)
Comment.belongsTo(UserStub, { foreignKey: 'authorId', as: 'author' });
UserStub.hasMany(Comment, { foreignKey: 'authorId', as: 'authoredComments' });
