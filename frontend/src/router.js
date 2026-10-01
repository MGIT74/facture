import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Dashboard from './views/Dashboard.vue';
import Clients from './views/Clients.vue';
import Items from './views/Items.vue';
import Payments from './views/Payments.vue';
import Companies from './views/Companies.vue';
import Settings from './views/Settings.vue';
import Templates from './views/settings/Templates.vue';
import TemplateEditor from './views/settings/TemplateEditor.vue';
import Users from './views/settings/Users.vue';
import Account from './views/settings/Account.vue';
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
    { path: '/companies', component: Companies },
    {
      path: '/settings',
      component: Settings,
      redirect: '/settings/templates',
      children: [
        { path: 'templates', component: Templates },
        { path: 'templates/new', component: TemplateEditor },
        { path: 'templates/:id', component: TemplateEditor },
        { path: 'users', component: Users },
        { path: 'account', component: Account },
      ],
    },
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
