import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats/stats.page').then((m) => m.StatsPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'add-habit',
    loadComponent: () => import('./add-habit/add-habit.page').then((m) => m.AddHabitPage),
  },
  {
    path: 'habit/:id/edit',
    loadComponent: () => import('./edit-habit/edit-habit.page').then((m) => m.EditHabitPage),
  },
  {
    path: 'habit/:id',
    loadComponent: () => import('./habit-detail/habit-detail.page').then((m) => m.HabitDetailPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
