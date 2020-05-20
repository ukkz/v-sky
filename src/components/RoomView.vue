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
                <video
                  class="video-stream ma-auto"
                  :id="(peer_id == skywaypeer.id) ? 'my-video-element' : peer_id"
                  :muted="(peer_id == skywaypeer.id)"
                  :srcObject.prop="stream"
                  autoplay
                  playsinline
                ></video>
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

  // joinとcloseは親コンポーネント側のv-if/v-elseによる当コンポーネント自体の描画の開始/終了に伴って実施されている
  // 開始: RoomListでVuexのルーム名を指定のものに設定 > Dashboardで変更検知してv-if=trueでこのコンポーネントを描画 > mounted().SkyWayPeer.join()
  // 終了: ここでVuexのルーム名を消去 > Dashboardで変更検知してv-if=falseでこのコンポーネントを削除 > beforedestroy().SkyWayRoom.close()
  mounted() {
    this.join(this.me.room);
    if (this.speech_onoff) this.startSpeechRecognition();
    if (this.qr_onoff) this.startQR();
  },
  beforeDestroy() {
    if (this.qr_onoff && this.develop_mode) console.log('QRコード認識を終了しました'); // destroyでループ関数ごと破棄されるっぽいのでこのままでよい 
    if (this.speech_onoff) this.endSpeechRecognition();
    this.close();
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
    // グローバル設定値監視:音声認識
    speech_onoff() { return this.$store.state.config.speech_recognition },
    // グローバル設定値監視:QR認識
    qr_onoff() { return this.$store.state.config.qr_recognition },
  },

  watch: {
    // 自分のストリームが変更された場合に更新する
    mystream(newstream) {
      if (this.skywaypeer && this.skywayroom) this.replaceStream(newstream);
    },
    // グローバル設定値変更検知:音声認識
    speech_onoff(current, previous) {
      if (current && !previous) this.startSpeechRecognition(); // 途中でオンにした
      if (!current && previous) this.endSpeechRecognition();   // 途中でオフにした
    },
    // グローバル設定値変更検知:QR認識
    qr_onoff(current, previous) {
      if (current && !previous) this.startQR(); // 途中でオンにした
      // 途中でオフにしたときは自動で停止する
    },
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

    // QR認識準備
    // 開始はqr_onoffをtrueにしてからstartQR()実行
    // 終了はqr_onoffをfalseにする
    startQR(interval = 10, fps = 5) {
      if (this.develop_mode) console.log('QRコード認識が開始されました');
      const crop_ratio = 0.5; // 1以下、映像中央から元と同一の縦横比の矩形を抜き出す
      const sd_w = 160;
      const interval_seconds = 1000 * interval;
      let buffer, myvideo, begin, delay, orig_w, orig_h, sd_h;

      const loop = async () => {
        // 無効のときはここですぐに出る（繰り返さない）
        if (!this.qr_onoff) {
          if (this.develop_mode) console.log('QRコード認識を終了しました');
          return;
        }
        // ---- 処理開始 ----
        begin = Date.now();
        // ビデオエレメントを取得する（メディア利用不可ならinterval秒間待って再試行）
        myvideo = document.getElementById('my-video-element');
        if (!myvideo || myvideo.readyState == 0) { setTimeout(loop, interval_seconds); return; }
        // ストリームのオリジナルサイズを取得
        orig_w = myvideo.videoWidth;
        orig_h = myvideo.videoHeight;
        // ストリームのアスペクト比と等しくなるよう認識用バッファキャンバスの高さを計算（幅は先に定義済み）
        sd_h = sd_w * orig_h / orig_w;
        // 非表示のバッファキャンバスを用意
        buffer = document.createElement('canvas').getContext('2d');
        // 縦横ともにcrop_ratio倍に縮小した矩形を中央部分から取り出してバッファに書く
        buffer.drawImage(myvideo,
          orig_w*(1-crop_ratio)/2, orig_h*(1-crop_ratio)/2, // ソース映像: 開始点
          orig_w*crop_ratio, orig_h*crop_ratio,             // ソース映像: クロップする幅と高さ
          0, 0,                                             // 貼付先バッファ: 開始点
          sd_w, sd_h,                                       // 貼付先バッファ: 貼り付ける幅と高さ（この大きさに拡縮）
        );
        // 貼り付けたサイズと同じぶんだけImageDataObjectとして抜き出す
        const frame = buffer.getImageData(0, 0, sd_w, sd_h);
        // jsQRに送ってQR検出を試みる
        const qr = jsQR(frame.data, frame.width, frame.height);
        if (qr) {
          // QR検出
          if (this.develop_mode) console.log('QRコードを検出しました / データ:', qr.data);
          const qr_img_data_url = await this.generateQRdataURL(qr.data);
          this.sendPayload(qr.data, 'qr', qr_img_data_url);
          // interval秒間は検出しない
          setTimeout(loop, interval_seconds);
          return;
        }
        // ---- 処理ここまで ----
        // fpsにあわせて次回の描画タイミングをセット
        delay = 1000/fps - (Date.now() - begin);
        setTimeout(loop, delay);
      };

      // 検出の開始
      loop();
    },

    // QRコード画像生成
    generateQRdataURL: async function(data) {
      // コールバックをawaitableにして待ち受ける
      const canvas = await (() => {
        return new Promise((resolve, reject) => {
          const c = document.createElement('canvas');
          QRCode.toCanvas(c, data, {
            margin: 2,
            scale: 10
          }, (error, target) => !error ? resolve(target) : reject(error));
        })
      })();
      // データURLに変換（imgタグのsrcに入れる用）
      return canvas.toDataURL();
    },

    // SkyWay:ルームに参加する
    join(meObjectRoom, isReplaceStream = false) {
      this.skywayroom = this.skywaypeer.joinRoom(meObjectRoom.name, {
        mode: meObjectRoom.type,
        stream: this.mystream,
        videoReceiveEnabled: true,
        audioReceiveEnabled: true,
      });
      // 自分が入室
      this.skywayroom.on('open', () => {
        if (isReplaceStream) {
          // ストリームの置き換え（すでに入室している）
          const as = this.mystream.getAudioTracks().length;
          const vs = this.mystream.getVideoTracks().length;
          if (this.develop_mode) console.log('ストリームの変更: [Video, Audio] = ['+vs+', '+as+']');
          // 画面上の自ストリームを消す
          this.removeStream(this.skywaypeer.id);
        } else {
          // 入室
          if (this.develop_mode) console.log('ルーム "' + meObjectRoom.name + '"（' + meObjectRoom.type + '）に入室しました');
          this.sendPayload(this.me.name+'さんが入室しました', 'system');
          // 親コンポーネントに通知（Dashboardのsyncを実行させる）
          this.$emit('roomChange');
        }
        // 画面上に自ストリームを追加（空ストリームでもよい）
        this.addMyStream(this.mystream);
      });
      // 誰かからのストリームを受信したらデータ内の配列に追加する
      this.skywayroom.on('stream', mediaStream => this.addStream(mediaStream));
      // 誰かが退室したらデータからも削除
      this.skywayroom.on('peerLeave', peerId => this.removeStream(peerId));
      // 誰かからデータ（チャットなど）を受信
      this.skywayroom.on('data', chat => this.addChat(chat.data));
      // 自分が退室（closeメソッド使用後に自動で発火）
      this.skywayroom.on('close', () => {
        if (this.develop_mode) console.log('ルーム "' + meObjectRoom.name + '"（' + meObjectRoom.type + '）から退室しました');
        this.removeAllStreams();
        this.skywayroom = null;
        // 親コンポーネントに通知（Dashboardのsyncを実行させる）
        this.$emit('roomChange');
      });
    },

    // SkyWay:ストリームを更新する
    replaceStream(newstream) {
      // openイベント・closeイベントを一時的に解除してからルームからストリームを抜く
      this.skywayroom.removeAllListeners('open').removeAllListeners('close').close();
      // 再入室する（ただしisReplaceStreamフラグのため通知チャットなどは送らない）
      // イベントは以下で再設定される
      this.join(this.me.room, true);
    },

    // SkyWay:ルームから退出する
    // 退出前にチャットを送っておく
    // このあとcloseイベントが発火してそのハンドラ内で実際に退出となる
    close() { this.sendPayload(this.me.name+'さんが退室しました', 'system'); this.skywayroom.close() },

    // データ全般の送信
    // type = user/system/speech/qr
    sendPayload: function(message, type = 'user', additional_data = null) {
      const payloadObject = {
        id: this.$store.state.me.id,
        name: this.$store.state.me.name,
        icon: this.$store.state.me.icon_url,
        type: type,
        body: message,
        data: additional_data,
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