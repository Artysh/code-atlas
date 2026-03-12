export interface RouteConfig {
  path: string;
  component: string;
  exact?: boolean;
}

export const routes: RouteConfig[] = [
  { path: '/', component: 'Home', exact: true },
  { path: '/about', component: 'About' },
  { path: '/users/:id', component: 'UserProfile' },
];
