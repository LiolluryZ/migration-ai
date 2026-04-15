import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routes — translated from config/urls.py + articles/urls.py +
 * accounts/urls.py + comments/urls.py.
 *
 * Source: config/urls.py :: urlpatterns (TM-001)
 * Each Django URL pattern maps to:
 *   - One Fastify route for data (backend/src/routes/)
 *   - One Angular route for rendering (here)
 *
 * Sprint 1: shell only — all page components are placeholder stubs.
 * Sprint 2+ will replace each loadComponent() with real implementations.
 */
export const routes: Routes = [
  // Home — articles/urls.py :: path('', home_view, name='home')
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },

  // Article detail — articles/urls.py :: path('article/<slug:slug>', ...)
  {
    path: 'article/:slug',
    loadComponent: () => import('./pages/article-detail/article-detail').then((m) => m.ArticleDetailComponent),
  },

  // New article — articles/urls.py :: path('editor', ..., name='article_create')
  // BR-005: @login_required → canActivate: [authGuard]
  {
    path: 'editor',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/editor/editor').then((m) => m.EditorComponent),
  },

  // Edit article — articles/urls.py :: path('editor/<slug:slug>', ..., name='article_edit')
  // BR-005: @login_required
  {
    path: 'editor/:slug',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/editor/editor').then((m) => m.EditorComponent),
  },

  // Login — accounts/urls.py :: path('login', ..., name='login')
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent),
  },

  // Register — accounts/urls.py :: path('register', ..., name='register')
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then((m) => m.RegisterComponent),
  },

  // Settings — accounts/urls.py :: path('settings', ..., name='settings')
  // BR-005: @login_required
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsComponent),
  },

  // User profile — accounts/urls.py :: path('profile/<str:username>', ..., name='profile')
  {
    path: 'profile/:username',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfileComponent),
  },

  // Profile favorites tab — accounts/urls.py :: path('profile/<str:username>/favorites', ...)
  {
    path: 'profile/:username/favorites',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfileComponent),
  },

  // Catch-all — redirect to home
  { path: '**', redirectTo: '' },
];
