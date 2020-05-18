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
        <v-btn v-if="$vuetify.breakpoint.smAndDown" fab depressed small color="green accent-3" @click.stop="chat_open = true"><v-icon>mdi-message-text</v-icon></v-btn>
        <v-btn v-else rounded depressed color="green accent-3" @click.stop="chat_open = true"><v-icon>mdi-message-text</v-icon>チャット</v-btn>
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

    <!-- :showで開く・toggleイベント受信で閉じる・sendイベント受信でメッセージ送信&チャット配列反映・反映後のチャット配列はそのままpropsで渡す -->
    <ChatWindow :show="chat_open" v-on:toggle="chat_open=$event" :me="me" :messages="chat_payloads" v-on:send="sendPayload($event)" />

  </v-card>

</template>


<script>
import ChatWindow from '@/components/ChatWindow.vue';

export default {
  name: 'RoomView',
  components: {
    ChatWindow,
  },

  props: {
    me: {
      type: Object,
      required: true,
    },
    mystream: {
      type: MediaStream,
      required: true,
      default: (new MediaStream()),
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
      // chat内をpeerの要素リンクにすると退室したら参照できなくなるので注意
      chat_open: false,
      chat_payloads: [],
      // 音声認識
      sr: {
        available: false,
        obj: null,
        buffer: '',
      },
    }
  },

  // 自分のRoomに名前が入る > v-ifで描画 > createdで実際にルームにjoinする
  created() {
    this.join(this.me.room);
    if (this.speech_onoff) this.startSpeechRecognition();
  },
  beforeDestroy() {
    if (this.speech_onoff) this.endSpeechRecognition();
    this.leave();
  },

  computed: {
    // このルームに参加している人数（受信専用も含むためストリーム数では数えられない）
    people_count() {
      let cnt = 0;      
      Object.keys(this.peers).forEach(id => { if (this.peers[id].room.name == this.me.room.name) cnt++; });
      return cnt;
    },
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
    // グローバル設定値監視：音声認識
    speech_onoff() { return this.$store.state.config.speech_recognition }
  },

  watch: {
    // 自分のストリームが変更された場合に更新する
    mystream(newstream) {
      if (this.skywaypeer && this.skywayroom) {
        // 送信しているストリームを付け替える
        this.skywayroom.replaceStream(newstream);
        // 画面上のストリームを一旦消して新しいものを追加する
        this.removeStream(this.skywaypeer.id);
        this.addMyStream(this.mystream);
      }
    },
    // グローバル設定値変更検知：音声認識
    speech_onoff(current, previous) {
      if (current && !previous) this.startSpeechRecognition(); // 途中でオンにした
      if (!current && previous) this.endSpeechRecognition();   // 途中でオフにした
    }
  },

  methods: {
    addStream: function(mediaStreamObject) { this.$set(this.streams, mediaStreamObject.peerId, mediaStreamObject) },
    addMyStream: function(mediaStreamObject) { if (mediaStreamObject) { mediaStreamObject['peerId'] = this.skywaypeer.id; this.addStream(mediaStreamObject) } },
    removeStream: function(target_id) { this.$delete(this.streams, target_id) },
    removeAllStreams: function() { this.$set(this, 'streams', {}) },

    // 文字起こし開始
    startSpeechRecognition() {
      window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      if ('SpeechRecognition' in window) {
        this.sr.available = true;
        if (this.develop_mode) console.log('音声認識が開始されました');
      } else {
        this.sr.available = false;
        if (this.develop_mode) console.log('音声認識に対応していないブラウザです');
        return; // 文字起こししない
      }
      // 音声認識の開始
      this.sr.obj = new SpeechRecognition();
      this.sr.obj.interimResults = true;
      this.sr.obj.continuous = true;
      this.sr.obj.lang = 'ja-JP';
      // 文字起こしを開始
      this.sr.obj.start();
      // 以下イベントハンドラ
      this.sr.obj.onresult = (e) => {
        this.sr.buffer = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          let transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            // センテンス終了（認識確定）
            this.sendPayload(transcript, 'speech');
          } else {
            // 認識の途中までバッファにいれておく（そのうち使う）
            this.sr.buffer = transcript;
          }
        }
      }
      // 認識終了したらもう一度開始させる
      // continuous=true のため基本的にずっと認識しっぱなしだが黙ってるとそのうち止まってしまう
      this.sr.obj.onend = () => {
        if (this.sr.obj) this.sr.obj.start();
      }
    },

    // 文字起こし終了
    endSpeechRecognition() {
      if (this.sr.available && this.sr.obj) {
        this.sr.obj.abort();
        this.sr.obj = null;
        this.sr.buffer = '';
        if (this.develop_mode) console.log('音声認識を終了しました');
      }
    },

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

    sendPayload: function(message, type = 'user') {
      // type = user/system/speech/qr
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
      this.chat_payloads.push(payloadObject);
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
</style>