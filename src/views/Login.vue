<template>
  <v-container>

    <v-row justify="center" align="center">
      <v-col cols="12" md="6">

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
          <v-card-subtitle>一時的にセッションが保存されるため、リロードごとに名前入力の必要がなくなります。</v-card-subtitle>
          <v-card-text>
            <v-row justify="center"><v-btn large color="success" class="ma-2" @click="loginWithLine">LINEアカウントでログイン</v-btn></v-row>
          </v-card-text>
        </v-card>

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
        v => (v && v.length >= 2)  || '2文字以上入力してください',
        v => (v && v.length <= 15) || '15文字以内にしてください',
        v => (v && /^[\S]+$/.test(v)) || '空白文字は使用できません',
      ],
    }
  },
  methods: {
    loginAsGuest: function() {
      // ゲストログイン      
      this.$router.push({ name: 'Dashboard', query: { guest: this.guest_name } });
    },
    loginWithLine: function() {
      // 未ログインならLINEへリダイレクト
      if (!liff.isLoggedIn()) liff.login();
    },
  },
}
</script>
