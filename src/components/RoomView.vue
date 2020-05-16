<template>
  <v-card class="mx-auto" outlined style="height:100%;">

    <!-- ルームの情報 -->
    <v-list-item>
      <!-- ルーム名 -->
      <v-list-item-content>
        <v-list-item-title class="headline">{{ me.room.name }} [{{ me.room.type.toUpperCase() }}]</v-list-item-title>
        <v-list-item-subtitle>参加数: {{ people_count }}</v-list-item-subtitle>
      </v-list-item-content>
      <!-- チャットオープンボタン -->
      <v-list-item-action>
        <v-btn v-if="$vuetify.breakpoint.smAndDown" fab depressed small color="green accent-3" @click.stop="chat_dialog = true"><v-icon>mdi-message-text</v-icon></v-btn>
        <v-btn v-else rounded depressed color="green accent-3" @click.stop="chat_dialog = true"><v-icon>mdi-message-text</v-icon>チャット</v-btn>
      </v-list-item-action>
      <!-- 退室ボタン -->
      <v-list-item-action>
        <v-btn v-if="$vuetify.breakpoint.smAndDown" fab depressed small dark color="pink lighten-1" @click="$store.dispatch('clearMyRoom')"><v-icon>mdi-logout</v-icon></v-btn>
        <v-btn v-else rounded depressed dark color="pink lighten-1" @click="$store.dispatch('clearMyRoom')"><v-icon>mdi-logout</v-icon>退室</v-btn>
      </v-list-item-action>
    </v-list-item>
  
    <!-- ストリーム -->
    <v-item-group>
      <v-container>
        <v-row dense>
          <v-col v-for="(stream, peer_id, index) in streams" :key="index" :cols="col_width" :sm="sm_width">
            <v-item>
              <v-responsive class="peer-frame" :aspect-ratio="16/5">
                <video class="video-stream ma-auto" :srcObject.prop="stream" autoplay playsinline :muted="(peer_id == skywaypeer.id)"></video>
                <div class="peer-icon">
                  <v-avatar color="indigo">
                    <v-icon v-if="!peers[peer_id].icon_url" dark>mdi-account-circle</v-icon>
                    <img v-else :src="peers[peer_id].icon_url">
                  </v-avatar>
                  <span class="px-2">{{ peers[peer_id].name }}</span>
                </div>
              </v-responsive>
            </v-item>
          </v-col>
        </v-row>
      </v-container>
    </v-item-group>

    <!-- チャットダイアログ -->
    <v-dialog v-model="chat_dialog" max-width="640" scrollable>
      <v-card style="background-color:rgba(255,255,255,0.7); overflow:hidden;">

        <v-card-title class="pt-3">チャット</v-card-title>
        <v-divider></v-divider>

        <v-card-text ref="message_area" style="height:70vh;">
          <v-list subheader style="background-color:transparent;">

            <!-- 基本CSSはmessageクラス・自分のみmessage-meクラス追加 -->
            <v-list-item v-for="(payload, index) in chat_payloads" :key="index" class="px-0 message" :class="{ 'message-me': (payload.id == me.id && payload.type == 'user') }">
              <v-avatar v-if="payload.type == 'system'" color="red" size="36" class="mx-1"><v-icon dark>mdi-robot</v-icon></v-avatar>
              <v-avatar v-else-if="!payload.icon" color="indigo" size="36" class="mx-1"><v-icon dark>mdi-account-circle</v-icon></v-avatar>
              <v-avatar v-else size="36" class="mx-1"><img :src="payload.icon"></v-avatar>
              <v-list-item-content class="my-n2">
                <v-list-item-subtitle class="name">{{ (payload.type == 'user') ? payload.name : 'V-Bot' }}</v-list-item-subtitle>

                <!-- メッセージ本文 -->
                <v-list-item-title class="frame">
                  <div v-if="payload.type == 'user'" class="body pa-2 green accent-1">{{ payload.body }}</div>
                  <div v-else class="body pa-2 cyan lighten-3" >{{ payload.body }}</div>
                </v-list-item-title>

              </v-list-item-content>
            </v-list-item>

          </v-list>
          <!-- スペーサー（これがないと最下部までスクロールしても入力部分で余白が出てしまう） -->
          <v-row style="height:5%;"></v-row>
        </v-card-text>

        <v-divider></v-divider>

        <!-- 送信フォーム -->
        <v-row class="pa-2" dense>
          <v-col cols="10" sm="11" class="mb-n6">
            <v-text-field autofocus dense outlined solo flat single-line v-model="my_message" label="Enterで送信" @keydown.enter="sendMessage"></v-text-field>
          </v-col>
          <v-col cols="2" sm="1">
            <v-btn fab depressed small color="green accent-3" @click="sendMessage"><v-icon>mdi-send</v-icon></v-btn>
          </v-col>
        </v-row>

      </v-card>
    </v-dialog>

  </v-card>
</template>


<script>
export default {
  name: 'RoomView',

  props: {
    me: {
      type: Object,
      required: true,
    },
    skywaypeer: {
      type: Object,
      required: true,
    },
    peers: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      develop_mode: (process.env.NODE_ENV == 'development'),
      skywayroom: null,
      streams: {},
      chat_dialog: false,
      my_message: '',
      // chat内をpeerの要素リンクにすると退室したら参照できなくなるので注意
      chat_payloads: [],
    }
  },

  // 自分のRoomに名前が入る > v-ifで描画 > createdで実際にルームにjoinする
  created() { this.join(this.me.room) },
  beforeDestroy() { this.leave() },

  computed: {
    // このルームに参加している人数（受信専用も含むためストリーム数では数えられない）
    people_count() {
      let cnt = 0;      
      Object.keys(this.peers).forEach(id => { if (this.peers[id].room.name == this.me.room.name) cnt++; });
      return cnt;
    },
    //
    mystream() { return this.$store.state.local_media_stream },
    // ストリームの配置オプション
    sm_width() {
      const l = Object.keys(this.streams).length;
      switch (l) {
        case 0:
        case 1:
          return 12;
        case 2:
          return 6;
        case 3:
          return 4;
        case 4:
          return 6;
        case 5:
        case 6:
          return 4;
        case 7:
        case 8:
          return 3;
        case 9:
          return 4;
        default:
          return 3;
      }
    },
    col_width() {
      const l = Object.keys(this.streams).length;
      switch (l) {
        case 0:
        case 1:
        case 2:
          return 12;
        default:
          return 6;
      }
    },
  },

  watch: {
    // 自分のストリームが変更された場合に更新する
    mystream(newstream, oldstream) {
      if (this.skywaypeer && this.skywayroom) {
        // 送信しているストリームを付け替える
        this.skywayroom.replaceStream(newstream);
        // 画面上のストリームを一旦消して新しいものを追加する
        this.removeStream(this.skywaypeer.id);
        this.addMyStream(this.mystream);
      }
    },
  },

  methods: {
    addStream: function(mediaStreamObject) { this.$set(this.streams, mediaStreamObject.peerId, mediaStreamObject) },
    addMyStream: function(mediaStreamObject) { if (mediaStreamObject) { mediaStreamObject['peerId'] = this.skywaypeer.id; this.addStream(mediaStreamObject) } },
    removeStream: function(target_id) { this.$delete(this.streams, target_id) },
    removeAllStreams: function() { this.$set(this, 'streams', {}) },

    // SkyWay:ルームに参加する
    join(meObjectRoom) {
      this.skywayroom = this.skywaypeer.joinRoom(meObjectRoom.name, {
        mode: meObjectRoom.type,
        stream: this.mystream,
        videoReceiveEnabled: true,
        audioReceiveEnabled: true,
      });
      // ルーム入室
      this.skywayroom.on('open', () => {
        // ルーム内ストリームのリストに自身を追加（空ストリームでもよい）
        this.addMyStream(this.mystream);
        if (this.develop_mode) console.log('ルーム"' + meObjectRoom.name + '"（' + meObjectRoom.type + '）に入室しました');
        this.sendPayload(this.me.name+'さんが入室しました', 'system');
        // 入室通知(sync)はDashboard$watchで行う[WIP]emitで発火させたい
      });
      // 誰かからのストリームを受信したらデータ内の配列に追加する
      this.skywayroom.on('stream', mediaStream => this.addStream(mediaStream));
      // 誰かが退室したらデータからも削除
      this.skywayroom.on('peerLeave', peerId => this.removeStream(peerId));
      // データ（チャットなど）を受信
      this.skywayroom.on('data', chat => this.addChat(chat.data) );
      // 自分が退室（closeメソッド使用後に自動で発火）
      this.skywayroom.on('close', () => {
        if (this.develop_mode) console.log('ルーム"' + meObjectRoom.name + '"（' + meObjectRoom.type + '）から退室しました');
        this.removeAllStreams();
        this.skywayroom = null;
        // 退室通知(sync)はDashboard$watchで行う[WIP]emitで発火させたい
      });
    },

    // SkyWay:ルームから退出する
    // 退出前にチャットを送っておく
    // 実際に退出したあとon.closeの発火でStreamsをクリアし退室した情報をsyncする
    leave() { this.sendPayload(this.me.name+'さんが退室しました', 'system'); this.skywayroom.close() },

    // メッセージ送信（ダイアログ内のボタンなどから発火）
    sendMessage: function(e) {
      // エンター送信時の日本語変換Enterの229は無視（通常は13）
      if (e instanceof KeyboardEvent && e.keyCode == 229) return;
      // 空文字は無視 / WIP 空白のみなどを正規表現でここで排除する
      if (!this.my_message) return;
      // チャット送信処理
      this.sendPayload(this.my_message, 'user');
      this.my_message = '';
    },

    sendPayload: function(message, type = 'user') {
      // type = user/system/speak/qr
      const payloadObject = {
        id: this.$store.state.me.id,
        name: this.$store.state.me.name,
        icon: this.$store.state.me.icon_url,
        type: type,
        body: message,
      };
      // 送信
      this.skywayroom.send(payloadObject);
      // 自分のチャットに反映
      this.addChat(payloadObject);
    },

    // チャット発言追加
    addChat: function(payloadObject) {
      if (!payloadObject.body) return;
      // type = user/system/speak/qr
      this.chat_payloads.push(payloadObject);
      // メッセージエリアを最下部までスクロールさせる
      if (this.$refs.message_area) {
        const scroll_size = this.$refs.message_area.scrollHeight;
        this.$refs.message_area.scrollTo(0, scroll_size);
      }
    },
  },
}
</script>


<style lang="scss">
.video-stream {
  background-color: #A0A0A0;
  //width: 100%;
  //height: auto;
}
.peer-frame {
  overflow: hidden;
}
.peer-icon {
  position:absolute;
  top:10px;left:10px;
  color:white;
  text-shadow:1px 1px 3px black;
}

// メッセージ全体
.message {  }
.message .frame { overflow:visible; }
.message .frame div.body {
  display: inline-block;
  box-shadow: 2px 2px 2px rgba(0, 0, 0, 0.5);
  border-radius: 0 20px 20px 20px;
}
// 以下は自分発のみ
.message-me { flex-flow: row-reverse; text-align: end; }
.message-me .frame div.body {
  box-shadow: -2px 2px 2px rgba(0, 0, 0, 0.5);
  border-radius: 20px 0 20px 20px;
}
</style>