import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Dashboard from './views/Dashboard.vue';
import Clients from './views/Clients.vue';
import Items from './views/Items.vue';
import Payments from './views/Payments.vue';
import Settings from './views/Settings.vue';
import DocumentList from './views/DocumentList.vue';
import DocumentForm from './views/DocumentForm.vue';
import DocumentView from './views/DocumentView.vue';

const doc = (path, type) => [
  { path: `/${path}`, component: DocumentList, props: { type } },
  { path: `/${path}/new`, component: DocumentForm, props: { type } },
  { path: `/${path}/:id`, component: DocumentView, props: (r) => ({ type, id: r.params.id }) },
  { path: `/${path}/:id/edit`, component: DocumentForm, props: (r) => ({ type, id: r.params.id }) },
];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login, meta: { public: true } },
    { path: '/', component: Dashboard },
    { path: '/clients', component: Clients },
    { path: '/items', component: Items },
    { path: '/payments', component: Payments },
    { path: '/settings', component: Settings },
    ...doc('invoices', 'invoice'),
    ...doc('quotes', 'quote'),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const logged = !!localStorage.getItem('token');
  if (!to.meta.public && !logged) return '/login';
  if (to.path === '/login' && logged) return '/';
});

export default router;
