<template>
  <v-container style="height:100%;">

    <!-- コアコンポーネント -->
    <v-row ref="core_area" justify="center" class="my-n5">
      <Core
        :shrink="true"
        @changeStream="setLocalMediaStream($event)"
      />
    </v-row>

    <!-- ストリーム部：高さ自動調整 -->
    <v-row ref="streams_area" justify="center" :style="style_stream_area">

      <!-- 3つの条件が揃ったら接続する -->
      <v-col v-if="direct_view_ready && peer_id_valid && mystream_available" cols="12">
        <DirectView
          :me="me"
          :client_peer_id="param_client_peerid"
          :mystream="local_media_stream"
          :skywaypeer="$store.state.skyway.peer"
          :chat_payloads="chat_payloads"
          @bye="bye()"
        />
      </v-col>

    </v-row>

  </v-container>
</template>



<script>
import Core       from '@/components/Core.vue'
import DirectView from '@/components/DirectView.vue'

export default {
  components: {
    Core,
    DirectView,
  },

  props: {
    // Vue Routerで設定される
    param_client_peerid: {
      type: String,
    },
  },

  data() {
    return {
      // メディア
      local_media_stream: (new MediaStream()), // 直接変更禁止
      // ルーム部のスタイル
      style_stream_area: { height: '100%' },
      // ルーム内チャットの配列・再入室時も保持できるため
      chat_payloads: [],
      // ルーム内部コンポーネントの表示準備
      direct_view_ready: false,
      peer_id_valid: false,     // シグナリングサーバからピアIDが取得できているか
      mystream_available: false,  // Coreが描画されたら最低1回メディアストリーム変更のemitがあるがそれを受信済みかどうか
    }
  },

  created() {
    // 相手のIDが指定されていない場合はDashboardに戻す
    if (!this.param_client_peerid) this.bye();
  },

  mounted() {
    this.direct_view_ready = true;
  },

  // 状態変化に伴うrerender後に発火
  updated() {
    // this.$refs.streams_area の高さを調整する
    const offset = parseInt(this.$refs.core_area.offsetHeight) - 38;
    this.style_stream_area.height = 'calc(100% - ' + offset + 'px)';
  },

  methods: {
    // 退室
    bye() {
      // Dashboardへ移動
      this.$router.push({ path: '/' }).catch(e => {}); // NavigationDuplicatedが出るので要修正
    },

    // Coreでストリームが変更（デバイスが変更）されたら発火する
    setLocalMediaStream(stream) {
      this.$set(this, 'local_media_stream', stream);
      this.mystream_available = true;
    },
  },

  computed: {
    // Vuex監視
    me() { return this.$store.state.me },
    my_peer_id() { return this.me.id },
  },

  watch: {
    // ピアIDを監視して空白でなければ peer_id_valid = true
    my_peer_id: {
      immediate: true,
      handler(current_peer_id) { this.peer_id_valid = (current_peer_id) ? true : false },
    },
  },
}
</script>