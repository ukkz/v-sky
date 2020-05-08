import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
})

router.beforeEach((to, from, next) => {
  liff.init({
    liffId: process.env.VUE_APP_LIFF_ID
  }, data => {
    // LIFF SDK 初期化できたらルーティング
    if (to.matched.some(record => record.meta.requiresAuth) && !liff.isLoggedIn()) {
      // 要認証ページへのアクセスかつLINE未ログイン
      if ('guest' in to.query && to.query.guest != '') {
        // GETパラメータのguestに何かしら文字列が入っていればそれをユーザー名としてログイン済みとする
        // 以下はそのままアクセス先ページへクエリ付きで飛ばされる
        next();
      } else {
        // ログインページへ
        next({ path: '/login' });
      }
    } else {
      // 認証不要またはLINEログイン済
      // 通常状態がこちらのルーティング
      next();
    }
  }, err => {
    console.log('LIFFの初期化に失敗しました(Vue-Router): ', err.code);
    next({ path: '/login' });
  });
});

export default router
