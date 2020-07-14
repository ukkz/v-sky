<template>
  <v-container>

    <v-row justify="center" align="center">
      <v-col cols="12" md="6">

        <!-- 1stepモード -->
        <v-card class="mx-auto mb-2" outlined v-if="onestep_mode">
          <v-card-title>ログイン</v-card-title>
          <v-card-subtitle>名前を入力して「参加」ボタンをクリックすることで、オンラインビデオチャットに参加します。</v-card-subtitle>
          <v-card-text>
            <v-form ref="form" v-model="guest_name_valid" @submit.prevent>
              <v-text-field v-model="guest_name" :counter="15" :rules="guest_name_rules" label="表示したい名前" required></v-text-field>
              <v-row justify="center"><v-btn color="primary" class="ma-2" @click="loginWith1S" :disabled="!guest_name_valid">参加</v-btn></v-row>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- 通常モード -->
        <template v-if="!onestep_mode">
          <v-card class="mx-auto mb-2" outlined>
            <v-card-title>ようこそ</v-card-title>
            <v-card-subtitle>以下のいずれかの方法でログインしてください。<br>LINE内部ブラウザ・iOS版Chromeブラウザでは利用できません。</v-card-subtitle>
          </v-card>
          <v-card class="mx-auto mb-2" outlined>
            <v-card-title>ゲストユーザとしてログイン</v-card-title>
            <v-card-subtitle>登録不要で誰でも参加できます。一部の機能は利用できません。</v-card-subtitle>
            <v-card-text>
              <v-form ref="form" v-model="guest_name_valid" @submit.prevent>
                <v-text-field v-model="guest_name" :counter="15" :rules="guest_name_rules" label="表示したい名前" required></v-text-field>
                <v-row justify="center"><v-btn color="primary" class="ma-2" @click="loginAsGuest" :disabled="!guest_name_valid">ゲストログイン</v-btn></v-row>
              </v-form>
            </v-card-text>
          </v-card>

          <v-card class="mx-auto mb-2" outlined>
            <v-card-title>LINEアカウントでログイン</v-card-title>
            <v-card-subtitle>LINEのユーザー名とアイコンを利用することができます。</v-card-subtitle>
            <v-card-text>
              <v-row justify="center"><v-btn large color="success" class="ma-2" @click="loginWithLine">LINEアカウントでログイン</v-btn></v-row>
            </v-card-text>
          </v-card>
        </template>

      </v-col>
    </v-row>

  </v-container>
</template>

<script>
export default {
  data() {
    return {
      guest_name: '',
      guest_name_valid: false,
      guest_name_rules: [
        v => !!v || '名前を入力してください',
        v => v && v.length >= 2  || '2文字以上入力してください',
        v => v && v.length <= 15 || '15文字以内にしてください',
        v => v && /^[\S]+$/.test(v) || '空白文字は使用できません',
      ],
    }
  },
  computed: {
    // 1stepモード（ダッシュボードを経由せず直接ルームを作って入れるモード）
    // 切り替えはここでしか行えないようにしておく
    onestep_mode: {
      get() { return this.$store.state.config.onestep_mode },
      set(onoff) { this.$store.commit('oneStepMode', onoff) },
    },
  },
  created() {
    // クエリパラメータに '1step' が入っていれば1stepモードになる
    this.onestep_mode = ('1step' in this.$route.query);
  },
  methods: {
    loginWith1S: function() {
      // 1stepモードでログイン
      // 名前を登録
      sessionStorage.setItem('guest', this.guest_name);
      // ルーム名を自動で作成して直接参加
      // ミリ秒-時分秒-base64表示名（20文字制限） となる
      const d = new Date();
      let room_name = '';
      room_name += String(d.getMilliseconds()) + '0';
      room_name += (d.getHours() < 10) ? '0' + d.getHours() : String(d.getHours());
      room_name += (d.getMinutes() < 10) ? '0' + d.getMinutes() : String(d.getMinutes());
      room_name += (d.getSeconds() < 10) ? '0' + d.getSeconds() : String(d.getSeconds());
      room_name += window.btoa(unescape(encodeURIComponent(this.guest_name)));
      room_name = room_name.replace(/=/g, '').substring(0, 20); // base64時のイコールを削除して文字数を制限する
      // ルームへ移動
      this.$router.push({ path: `/room/${room_name}` });
    },
    loginAsGuest: function() {
      // ゲストログイン
      // 名前を登録
      sessionStorage.setItem('guest', this.guest_name);
      // リダイレクト先がクエリで指定されていればそちらへ移動、なければルート（Dashboard）へ
      this.$router.push( this.$route.query.redirect || '/' );
    },
    loginWithLine: function() {
      // 未ログインならLINEへリダイレクト
      if (!liff.isLoggedIn()) liff.login();
    },
  },
}
</script>
