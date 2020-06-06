import Vue from 'vue'
import VueRouter from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Login from '@/views/Login.vue'
import Room from '@/views/Room.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    component: Dashboard,
    meta: { requiresAuth: true, },
  },
  {
    path: '/room/:param_room_name',
    component: Room,
    props: true,
    meta: { requiresAuth: true, },
  },
  {
    path: '/login',
    component: Login,
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
      const guest_name = sessionStorage.getItem('guest');
      if (guest_name) {
        // セッションストレージのguestに名前が設定されていればゲストとしてログイン
        next();
      } else {
        // ログインページへ（ルームへ直接アクセスしようとした場合はリダイレクトとしてクエリに含める）
        next({ path: '/login', query: { redirect: to.path } });
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
