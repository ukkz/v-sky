<template>
  <!-- ダイレクト応答ダイアログ -->
  <v-dialog v-model="toggle" max-width="360" persistent>
    <v-card class="pa-4" style="background-color:rgba(255,255,255,0.8);">

      <v-card-text class="pt-6" align="center"><h2>ダイレクトコール 着信</h2></v-card-text>

      <v-card-text align="center">
        <v-avatar size="40" color="indigo">
          <img v-if="client_icon_url" :src="client_icon_url">
          <v-icon v-else dark>mdi-account-circle</v-icon>
        </v-avatar>
        <h3 class="pa-3">{{ client_name }} さん</h3>
        <v-btn class="py-2 mr-5" fab depressed dark large color="green" @click="answer()"><v-icon dark>mdi-phone</v-icon></v-btn>
        <v-btn class="py-2 ml-5" fab depressed dark large color="red" @click="reject()"><v-icon dark>mdi-phone-hangup</v-icon></v-btn>
      </v-card-text>

    </v-card>
  </v-dialog>
</template>


<script>
export default {
  name: 'DirectAnswer',

  data() {
    return {
      client_name: '',
      client_icon_url: '',
      toggle: false,
      call: null,
    }
  },

  mounted() {
    this.$store.state.skyway.peer.on('call', call => {
      // ダイアログを開いてMediaConnectionをコンポーネント変数へコピー
      this.toggle = true;
      this.call = call;
      // ピアIDから相手の名前とアイコンURLを探す
      const client = this.$store.getters.peer_data(call.remoteId);
      this.client_name = (client) ? client.name : 'unknown';
      this.client_icon_url = (client) ? client.icon_url : '';
    });
  },

  beforeDestroy() {
    // リスナを削除
    if (this.$store.state.skyway.peer != null) this.$store.state.skyway.peer.removeAllListeners('call');
    this.call = null;
  },

  methods: {
    // 応答する
    answer: function() {
      // 受信したMediaConnectionをVuexにセット
      if (this.call != null) this.$store.commit('setDirectMediaConnection', this.call);
      // ダイレクトコールページへ移動
      this.$nextTick(() => this.$router.push({ path: '/direct/' + this.call.remoteId }));
    },
    // 拒否する
    reject: function() {
      // 受信したMediaConnectionを切る
      // WIP:このままでは拒否されたことを発信側で検知できないため要修正
      this.call.close(true);
      // ダイアログを閉じる
      this.toggle = false;
    },
  },

  computed: {
    // Vuex監視
    client_data() { return this.$store.getters.peer_data(this.destination_peer_id) },
  },
}
</script>


<style lang="scss">

</style>