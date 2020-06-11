<template>
  <v-card class="mx-auto" outlined style="height:100%;" ref="direct_area">

    <v-list-item ref="info_area">
      <v-list-item-content>
        <!-- 接続先の名前 -->
        <v-list-item-title class="headline">
          {{ (client_data) ? '1-on-1 : ' + client_data.name : 'Connection unavailable' }}
        </v-list-item-title>
      </v-list-item-content>
      <!-- チャットオープンボタン -->
      <v-list-item-action>
        <v-btn v-if="$vuetify.breakpoint.xs" fab depressed small color="green accent-3" @click.stop="chat_open = true"><v-icon>mdi-message-text</v-icon></v-btn>
        <v-btn v-else rounded depressed color="green accent-3" @click.stop="chat_open = true"><v-icon>mdi-message-text</v-icon>チャット</v-btn>
      </v-list-item-action>
      <!-- 切断ボタン -->
      <v-list-item-action>
        <v-btn v-if="$vuetify.breakpoint.xs" fab depressed small dark color="pink lighten-1" @click="$emit('bye')"><v-icon>mdi-phone-hangup</v-icon></v-btn>
        <v-btn v-else rounded depressed dark color="pink lighten-1" @click="$emit('bye')"><v-icon>mdi-phone-hangup</v-icon>切断</v-btn>
      </v-list-item-action>
    </v-list-item>
  
    <!-- ストリーム -->
    <v-item-group>
      <v-container class="pa-0">
        <v-row justify="center" align="center" no-gutters>

          <!-- 自分のストリーム -->
          <v-col
            cols="12" sm="6" class="pa-1" align-self="center"
            :style="{
              'max-height': '100%',
              height: stream_height + 'px',
            }"
          >
            <v-item>
              <div class="peer-frame">
                <video id="my-video-element" class="peer-video mirror" :srcObject.prop="mystream" autoplay playsinline muted></video>
                <div class="peer-name pa-2">
                  <v-avatar :size="($vuetify.breakpoint.smAndDown) ? 20 : 40" color="indigo">
                    <img v-if="me.icon_url" :src="me.icon_url">
                    <v-icon v-else dark>mdi-account-circle</v-icon>
                  </v-avatar>
                  <span class="px-2">{{ me.name }}</span>
                </div>
              </div>
            </v-item>
          </v-col>

          <!-- 相手のストリーム -->
          <v-col
            cols="12" sm="6" class="pa-1" align-self="center"
            :style="{
              'max-height': '100%',
              height: stream_height + 'px',
            }"
          >
            <v-item>
              <div class="peer-frame">
                <video id="client-video-element" class="peer-video" :srcObject.prop="client_stream" autoplay playsinline></video>
                <div class="peer-name pa-2">
                  <v-avatar :size="($vuetify.breakpoint.smAndDown) ? 20 : 40" color="indigo">
                    <img v-if="client_data && client_data.icon_url" :src="client_data.icon_url">
                    <v-icon v-else dark>mdi-account-circle</v-icon>
                  </v-avatar>
                  <span class="px-2">{{ (client_data) ? client_data.name : '' }}</span>
                </div>
                <div class="peer-overlay">
                  <v-icon v-if="phone_icon_visible" size="60" color="red">mdi-phone-outgoing</v-icon>
                </div>
              </div>
            </v-item>
          </v-col>

        </v-row>
      </v-container>
    </v-item-group>

    <!-- :showで開く・toggleイベント受信で閉じる・sendイベント受信でメッセージ送信&チャット配列反映・反映後のチャット配列はそのままpropsで渡す -->
    <ChatWindow
      :show="chat_open"
      :me="me"
      :messages="chat_payloads"
      @toggle="chat_open = $event"
      @send="sendPayload($event)"
    />

  </v-card>

</template>


<script>
import ChatWindow from '@/components/ChatWindow.vue';

export default {
  name: 'DirectView',
  components: {
    ChatWindow,
  },

  props: {
    me: {
      type: Object,
      required: true,
    },
    client_peer_id: {
      type: String,
    },
    mystream: {
      type: MediaStream,
      required: true,
    },
    skywaypeer: {
      type: Object,
      required: true,
    },
    chat_payloads: {
      type: Array,
      required: true,
    },
  },

  data() {
    return {
      develop_mode: (process.env.NODE_ENV == 'development'),
      // 直接コネクション
      media_connection: null,
      data_connection: null,
      // 相手のストリーム
      client_stream: (new MediaStream()),
      client_is_online: false,
      // 相手が応答するまでアイコンを点滅させる
      phone_icon_blinker: null,
      phone_icon_visible: true,
      // 各ストリームの高さ（mounted時にセットする）
      // これはマウント中には基本的には変化しない
      stream_height: 0,
      // チャットウインドウの開閉
      chat_open: false,
    }
  },

  mounted() {
    // 最初にメディア接続を確立させる
    // 発信時：media_connectionを作成してこのコンポーネント変数にセットする
    // 着信時：Vuexにすでにセットされている相手からのmedia_connectionに対してanswerする
    if (this.$store.getters.is_direct_caller) {
      // call（発信側）
      // 対象ピアがオフラインであればダイアログ表示後にDashboardへ戻す
      this.skywaypeer.once('error', error => {
        if (error.type == 'peer-unavailable') {
          alert('指定されたピア "' + this.client_peer_id + '" はオフラインのため接続できません。');
          this.$emit('bye');
        }
      });
      // ここでmedia_connectionを作成する
      this.media_connection = this.skywaypeer.call(this.client_peer_id, this.mystream, {
        audioReceiveEnabled: true,
        videoReceiveEnabled: true,
      });
      // 応答を待つ（アイコン点滅）
      this.phone_icon_blinker = setInterval(() => {
        this.phone_icon_visible = !this.phone_icon_visible;
      }, 500);
    } else {
      // answer（着信側）
      // Vuexからコピー
      this.media_connection = this.$store.state.skyway.direct_media_connection;
      this.media_connection.answer(this.mystream);
    }

    // 相手ストリームを受信
    this.media_connection.on('stream', stream => {
      // アイコン点滅を解除
      if (this.phone_icon_blinker) clearInterval(this.phone_icon_blinker);
      this.phone_icon_visible = false;
      // 相手ストリームをセット
      this.$set(this, 'client_stream', stream);
    });
    // 切断されたときは親コンポーネントからdestroyする
    this.media_connection.on('close', () => this.$emit('bye'));

    // ストリームの高さ（スマホサイズ時は半分にして縦並びに）
    this.$nextTick(() => {
      const initial_stream_area_height = this.$refs.direct_area.$el.offsetHeight - this.$refs.info_area.$el.offsetHeight;
      this.stream_height = initial_stream_area_height / ((this.$vuetify.breakpoint.smAndDown) ? 2 : 1);
    });
  },

  beforeDestroy() {
    // media_connectionを切断する
    if (this.media_connection != null) this.media_connection.close(true);
    // 自分が着信側の場合はVuex側にオブジェクトが残っているのでnullに戻しておく
    this.$store.commit('clearDirectMediaConnection');
    // リスナを削除
    this.skywaypeer.removeAllListeners('error');
  },

  computed: {
    // Vuex監視
    client_data() { return this.$store.getters.peer_data(this.client_peer_id) },
    onReceivePayload() { return this.$store.state.client_payload_buffer }, // 追加データ（payload）つきで受信したらバッファが変化 > ここ発火
  },

  watch: {
    // 自分のストリームが変更された場合に更新する
    mystream(newstream) {
      // 新しいストリームのトラック数を確認
      const audio_count = parseInt(newstream.getAudioTracks().length);
      const video_count = parseInt(newstream.getVideoTracks().length);
      if (this.develop_mode) console.log('メディアストリーム変更: VideoTracks('+video_count+'), AudioTracks('+audio_count+')');
      // 切り替え
      this.media_connection.replaceStream(newstream);
    },

    // 相手のオンライン状態を監視
    client_data(val) {
      // 最初：データがundefinedでなくなったときにオンラインフラグがfalseならtrueに切替
      if (!this.client_is_online && val) this.client_is_online = true;
      // 次回以降：オンラインフラグがtrueのときにデータがundefinedになったら切断された
      if (this.client_is_online && !val) {
        alert('相手ピア "' + this.client_peer_id + '" がオフラインになったため接続を終了します。');
        this.$emit('bye');
      }
    },

    // データ受信したらチャットに反映させる
    onReceivePayload(obj) { this.addChat(obj) },
  },

  methods: {
    // データ全般の送信
    // type = user/speech/qr/system
    // type = qr のとき additional_data = [ IMAGE DATA URL ]
    // type = system のとき message = join / info , additional_data = meObject (this.meと同じ)
    sendPayload: function(message, type = 'user', additional_data = null) {
      // DataConnectionはVuexからとってくる
      const data_connection = this.$store.getters.connection(this.client_peer_id);
      // 存在しないかすでに閉じられていれば送らない
      if (!data_connection || !data_connection.open) return;
      // meObjectをコピーしてpayload要素を追加する
      let meCopyObj = Object.assign({}, this.me);
      meCopyObj['payload'] = {
        id: this.me.id,
        name: this.me.name,
        icon: this.me.icon_url,
        type: type,
        body: message,
        data: additional_data,
      };
      // 送信（payload単体ではなくmeObjectに含めて全体を送る）
      data_connection.send(meCopyObj);
      // 自分のチャットに反映
      this.addChat(meCopyObj['payload']);
    },

    // チャット発言追加
    addChat: function(payloadObject) {
      // システムメッセージであるか、bodyが空のときは無視する
      if (payloadObject.type == 'system' || !payloadObject.body) return;
      this.chat_payloads.push(payloadObject);
    },
  },
}
</script>


<style lang="scss">
div.peer-frame {
  background-color: #010101;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 30px;
}
video.peer-video {
  background-color: #010101;
  position: absolute;
  width: auto;
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
}
video.mirror {
  transform: translateX(-50%) scale(-1, 1) ;
}
div.peer-name {
  position: absolute;
  top:5px; left:5px;
  color: white;
  text-shadow: 1px 1px 3px black;
}
div.peer-overlay {
  position: absolute;
  top:0px; left:0px;
  width: 100%;
  height: 100%;
  border-radius: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>