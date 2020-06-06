<template>
  <v-container style="height:100%;">

    <!-- コアコンポーネント -->
    <v-row ref="core_area" justify="center" class="my-n5">
      <Core
        :shrink="true"
        @changeStream="setLocalMediaStream($event)"
      />
    </v-row>

    <!-- ルーム内：高さ自動調整 -->
    <v-row ref="room_area" justify="center" :style="style_room_area">

      <!-- 4条件が揃ったらルーム入室する -->
      <v-col v-if="peer_id_valid && room_config_valid && mystream_available" cols="12">
        <RoomView
          :me="me"
          :mystream="local_media_stream"
          :skywaypeer="$store.state.skyway.peer"
          @sync="$store.dispatch('sync')"
          @changeRoom="changeRoom($event)"
          @leave="leave()"
        />
      </v-col>

    </v-row>

  </v-container>
</template>



<script>
import Core   from '@/components/Core.vue'
import RoomView from '@/components/RoomView.vue'

export default {
  components: {
    Core,
    RoomView,
  },

  props: {
    // Vue Routerで設定される
    param_room_name: {
      type: String,
    },
  },

  data() {
    return {
      // メディア
      local_media_stream: (new MediaStream()), // 直接変更禁止
      // ルーム部のスタイル
      style_room_area: {
        height: '100%',
      },
      // ルーム内部コンポーネントの表示準備
      peer_id_valid: false,     // シグナリングサーバからピアIDが取得できているか
      room_config_valid: false, // ルーム名がルール内（半角英数字3~20文字）かつtypeとpublicが指定されているか
      mystream_available: false,  // Coreが描画されたら最低1回メディアストリーム変更のemitがあるがそれを受信済みかどうか
    }
  },

  mounted() {
    if (!this.stored_room_name) {
      // URL直接指定などでVuexにルーム名がセットされていないとき
      // 最初にURLパラメータで指定されたルーム名を検証してダメならDashboardに戻す
      if ( !(/^[0-9a-zA-Z]{3,20}$/.test(this.param_room_name)) ) {
        alert('ルーム名 "' + this.param_room_name + '" は利用できません');
        this.$router.push({ path: '/' });
      }
      // ルーム名大丈夫そうならルーム条件をデフォルト値で作成
      const pre_room = {
        name: this.param_room_name, // URLパラメータのやつ
        type: 'mesh',
        public: true,
        rejoin: false,
      };
      // セットする
      // このあとwatch()が発火して this.room_config_valid = true になる
      this.$store.commit('setMyRoom', pre_room);
    }
  },

  // 状態変化に伴うrerender後に発火
  updated() {
    // this.$refs.room_area の高さを調整する
    const offset = parseInt(this.$refs.core_area.offsetHeight) - 38;
    this.style_room_area.height = 'calc(100% - ' + offset + 'px)';
  },

  methods: {
    // ルームのタイプ変更またはストリーム更新による再入室
    // RoomViewからの通知を受けて実行される
    changeRoom(new_room_option) {
      // 現在のルーム状態に再入室するルーム状態をマージ（上書き）
      // 引数はtypeやpublicなどの単一要素を想定
      let new_room_obj = Object.assign({}, this.me.room);
      if (new_room_option) new_room_obj = Object.assign(new_room_obj, new_room_option); // 引数があった場合のみルーム設定を書き換える
      // 一度ルームをクリアする
      this.$store.commit('clearMyRoom'); // this.room_config_valid = false になり RoomView > destroy()
      // データの反映とDOMの反映が行われたのちに再度ルーム変数をセットしてRoomViewをmountする
      this.$nextTick(() => this.$store.commit('setMyRoom', new_room_obj));
    },

    // 退室
    leave() {
      this.$store.commit('clearMyRoom'); // this.room_config_valid = false になり RoomView > destroy()
      // Dashboardへ移動
      this.$nextTick(() => this.$router.push({ path: '/' }));
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
    stored_room_name() { return this.me.room.name },
  },

  watch: {
    // ピアIDを監視して空白でなければ peer_id_valid = true
    my_peer_id: {
      immediate: true,
      handler(current_peer_id) { this.peer_id_valid = (current_peer_id) ? true : false },
    },
    // ルーム名を監視して正規表現に合致していれば room_config_valid = true
    stored_room_name: {
      immediate: true,
      handler(current_room_name) { this.room_config_valid = (/^[0-9a-zA-Z]{3,20}$/.test(current_room_name)) ? true : false },
    },
  },
}
</script>