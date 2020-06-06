<template>
  <v-card class="mx-auto" outlined style="height:100%;" ref="room_area">

    <!-- ルームの情報 -->
    <v-list-item ref="info_area">
      <!-- ルーム名 -->
      <v-list-item-content>
        <!-- ルーム名 -->
        <v-list-item-title class="headline">
          {{ me.room.name }}
        </v-list-item-title>
        <!-- 参加人数・ルームタイプ・公開状態 -->
        <v-list-item-subtitle>
          <v-chip color="black" class="mr-1" outlined label small><v-icon left>mdi-account</v-icon>{{ people_count }}人</v-chip>
          <v-chip
            :color="(me.room.type == 'mesh') ? 'green darken-2' : 'deep-orange accent-3'"
            text-color="white" class="mx-1" small
          >{{ me.room.type.toUpperCase() }}</v-chip>
          <v-chip
            :color="(is_public === null) ? 'grey' : (is_public === true) ? 'amber darken-2' : 'teal'"
            text-color="white" class="mx-1" small
          >{{ (is_public === null) ? '不明' : (is_public === true) ? '公開' : '限定' }}</v-chip>
        </v-list-item-subtitle>
      </v-list-item-content>
      <!-- チャットオープンボタン -->
      <v-list-item-action>
        <v-btn v-if="$vuetify.breakpoint.xs" fab depressed small color="green accent-3" @click.stop="chat_open = true"><v-icon>mdi-message-text</v-icon></v-btn>
        <v-btn v-else rounded depressed color="green accent-3" @click.stop="chat_open = true"><v-icon>mdi-message-text</v-icon>チャット</v-btn>
      </v-list-item-action>
      <!-- 退室ボタン -->
      <v-list-item-action>
        <v-btn v-if="$vuetify.breakpoint.xs" fab depressed small dark color="pink lighten-1" @click="$emit('leave')"><v-icon>mdi-logout</v-icon></v-btn>
        <v-btn v-else rounded depressed dark color="pink lighten-1" @click="$emit('leave')"><v-icon>mdi-logout</v-icon>退室</v-btn>
      </v-list-item-action>
    </v-list-item>
  
    <!-- ストリーム -->
    <v-item-group>
      <v-container class="pa-0">
        <v-row justify="center" align="center" no-gutters>
          <v-col
            v-for="(stream, id, index) in streams"
            :key="index"
            :cols="col_width"
            :sm="sm_width"
            class="pa-1"
            :style="{
              'max-height': '100%',
              height: (($vuetify.breakpoint.smAndDown) ? col_height(col_width) : col_height(sm_width))+'px',
            }"
            align-self="center"
          >
            <v-item>

              <div class="peer-frame">
                <video
                  class="peer-video"
                  :class="{mirror: (id == skywaypeer.id)}"
                  :id="(id == skywaypeer.id) ? 'my-video-element' : id"
                  :muted="(id == skywaypeer.id)"
                  :srcObject.prop="stream"
                  autoplay
                  playsinline
                ></video>
                <div class="peer-name pa-2">
                  <v-avatar :size="($vuetify.breakpoint.smAndDown) ? 20 : 40" color="indigo">
                    <img v-if="(id in room_peers) && room_peers[id].icon_url" :src="room_peers[id].icon_url">
                    <v-icon v-else dark>mdi-account-circle</v-icon>
                  </v-avatar>
                  <span class="px-2">{{ (id in room_peers) ? room_peers[id].name : 'unknown' }}</span>
                </div>
                <div
                  class="peer-overlay"
                  :style="{
                    'background-color': (stream.video_muted) ? 'rgba(1, 1, 1, 0.7)' : 'transparent'
                  }"
                >
                  <v-icon
                    v-if="(stream.video_muted)"
                    size="60" color="red"
                  >mdi-video-off</v-icon>
                  <v-icon
                    v-if="(stream.audio_muted)"
                    size="60" color="red"
                  >mdi-microphone-off</v-icon>
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
    },
    skywaypeer: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      develop_mode: (process.env.NODE_ENV == 'development'),
      // Roomオブジェクト
      skywayroom: null,
      // ルーム内ピアとストリームのリスト（PeerIDがキー名）
      // ピアは全員分入るがストリームはないこともある
      room_peers: {},
      streams: {},
      // 公開フラグ・入室後の通信で明示的にtrueまたはfalseで設定される
      // this.me.room.public より ルーム内の通信で共有された公開状態を優先させるため
      // 先にこのフラグで情報を同期してからmeObjectに反映させる
      is_public: null,
      // botによる退室メッセージを送らない ... 再入室の前にtrueにする
      not_send_my_leaving: false,
      // chat内をpeerの要素リンクにすると誰かが退室したらその人の過去チャットが参照できなくなるので注意
      chat_open: false,
      chat_payloads: [],
      // 音声認識
      sr: {
        available: false,
        obj: null,
        buffer: '',
      },
      // ルームの初期高さ（mounted時にセットする）
      // これはマウント中には基本的には変化しない
      initial_room_height: 0,
    }
  },

  // joinとcloseは親コンポーネント側のv-if/v-elseによる当コンポーネント自体の描画の開始/終了に伴って実施されている
  // 開始: RoomListでVuexのルーム名を指定のものに設定 > Dashboardで変更検知してv-if=trueでこのコンポーネントを描画 > mounted().SkyWayPeer.join()
  // 終了: ここでVuexのルーム名を消去 > Dashboardで変更検知してv-if=falseでこのコンポーネントを削除 > beforedestroy().SkyWayRoom.close()
  mounted() {
    // SkyWayRoom参加
    this.join();
    // 補助機能の開始
    if (this.speech_onoff) this.startSpeechRecognition();
    if (this.qr_onoff) this.startQR();
    // ストリームエレメントが利用可能なルーム内の高さ制限（このあと自ストリームがルームに追加されたら1回だけ更新する）
    this.initial_room_height = this.$refs.room_area.$el.offsetHeight - this.$refs.info_area.$el.offsetHeight;
  },
  beforeDestroy() {
    // 補助機能の終了
    if (this.qr_onoff && this.develop_mode) console.log('QRコード認識を終了しました'); // destroyでループ関数ごと破棄されるっぽいのでこのままでよい 
    if (this.speech_onoff) this.endSpeechRecognition();
    // SkyWayRoom切断
    this.close();
  },

  computed: {
    // このルームに参加している人数
    people_count() { return Object.keys(this.room_peers).length },
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
      // 新しいストリームのトラック数を確認
      const audio_count = parseInt(newstream.getAudioTracks().length);
      const video_count = parseInt(newstream.getVideoTracks().length);
      if (this.develop_mode) console.log('メディアストリーム変更: VideoTracks('+video_count+'), AudioTracks('+audio_count+')');
      // changeRoomイベントを親コンポーネントに送出
      this.not_send_my_leaving = true; // close()で退室メッセージを送らない
      this.$emit('changeRoom');
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
    addMyStream: function() { this.mystream['peerId'] = this.skywaypeer.id; this.addStream(this.mystream) },
    removeStream: function(target_id) { this.$delete(this.streams, target_id) },
    addPeer: function(meObject) {
      this.$set(this.room_peers, meObject.id, meObject);
      if (!(meObject.id in this.streams)) this.$set(this.streams, meObject.id, (new MediaStream()) );
    },
    removePeer: function(target_id) {
      this.removeStream(target_id);
      this.$delete(this.room_peers, target_id);
    },

    // colsの個数とcontainerの高さから段数を求めてcols1つあたりの高さを出す
    col_height(col_width) {
      // ストリーム数（参加ユーザー数）
      const l = Object.keys(this.streams).length;
      // ストリームの段数（col_widthはpxでなくブレイクポイントのグリッド幅数、12が全幅）
      const rows = (col_width > 0) ? Math.ceil(l / (12 / col_width)) : 1;
      // ルームの高さを必要段数で割る（端数切り上げ）
      return Math.floor(this.initial_room_height / rows);
    },

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
    join() {
      // エラー（同名で異なるタイプのルームに入室してしまったとき用）
      this.skywaypeer.once('error', error => {
        if (error.type == 'room-error') {
          if (this.develop_mode) console.log('通信タイプの異なる同名ルームが存在するため再入室します');
          // ルームタイプ切替・再入室フラグ設定
          const new_room_type = (this.me.room.type == 'mesh') ? 'sfu' : 'mesh';
          // 書き換えたルーム情報で再入室
          this.$emit('changeRoom', { type: new_room_type, rejoin: true, });
          // 親コンポーネント側でdestroyされたあと再mountされる
        } else {
          if (this.develop_mode) console.log('未定義エラー:', error);
        }
      });
      // 実際の入室
      this.skywaypeer.rooms = {};
      this.skywayroom = this.skywaypeer.joinRoom(this.me.room.name, {
        mode: this.me.room.type,
        stream: this.mystream,
        videoReceiveEnabled: true,
        audioReceiveEnabled: true,
      });
      // シグナリングサーバからログを受信する（入室直後にgetLogを行う）
      this.skywayroom.once('log', log => {
        // logは配列になっており自分が最初の入室（= 作成者）のとき配列長は1となる
        // 自分が作成者であれば公開状態はmeObjectからコピーし必ずtrueかfalseのどちらかになる
        // 既にルームがある場合は他の参加者から情報をもらうまで公開状態は未確定とする
        this.is_public = (log.length == 1) ? this.me.room.public : null;
        // 自分が作成者 かつ 公開設定 かつ 再入室ではない 場合のみ親コンポーネントに通知（Dashboardのsyncを実行し公開ルームを作成・入室したことを全体通知）
        if (this.is_public === true && this.me.room.rejoin !== true) this.$emit('sync');
        // dump
        if (this.develop_mode && this.me.room.rejoin !== true) {
          if (this.is_public === true)  console.log('公開ルームを新規作成しました');
          if (this.is_public === false) console.log('限定ルームを新規作成しました');
          console.log('ルーム "' + this.me.room.name + '"（' + this.me.room.type + '）に入室しました');
          if (this.is_public === null)  console.log('ルームの公開状態を他のピアから取得します');
        }
      });
      // 自分が入室
      this.skywayroom.once('open', () => {
        // ピアリストに自身を追加
        this.addPeer(this.me);
        // ログ要求によりルームが新規かどうか確認
        this.skywayroom.getLog();
        // 入室通知（peerJoinイベントではなくこちらを使う）
        this.sendPayload('join', 'system', this.me);
        // 再入室の場合で退避されたチャットがあれば復元する
        this.$store.state.chat_history.forEach(payloadObject => this.chat_payloads.push(payloadObject));
        this.$store.commit('clearChatLog');
        // 自分が入室したことをチャットに送る（ただし再入室の場合は送らない）
        if (this.me.room.rejoin !== true) this.sendPayload(this.me.name+'さんが入室しました', 'bot');
        // ストリームの映像枠が利用可能なエリアの高さを更新する（これ以降は変更させない）
        this.initial_room_height = this.$refs.room_area.$el.offsetHeight - this.$refs.info_area.$el.offsetHeight;
        // 画面上に自ストリームを追加（空ストリームでもよい）
        this.addMyStream();
      });
      // 誰かからのストリームを受信したらデータ内の配列に追加または更新する
      // ビデオか音声どちらかだけをunmuteしたときも発火するが、引数のstreamにはそのunmuteした単一のトラックのみしか入っていない
      // そのため手元に保持しているリモートのストリームをマージする必要がある（置き換えてしまうとunmuteしたトラックのみになってしまう）
      this.skywayroom.on('stream', mediaStream =>this.addStream(mediaStream));
      // 誰かが退室したらピア情報とストリームの両方を削除
      this.skywayroom.on('peerLeave', peerId => this.removePeer(peerId));
      // 誰かからデータ（チャットなど）を受信
      // 引数の中身のdataプロパティがデータ本体
      this.skywayroom.on('data', payload => {
        const payloadObject = payload.data;
        // チャットに追加（システムメッセージは無視される）
        this.addChat(payloadObject);
        // 以下はシステムメッセージの場合の処理
        if (payloadObject.type == 'system') {
          // 情報種別
          switch (payloadObject.body) {
            case 'join': // 入室通知の受信
              // 対象（新しく入室してきたピア）を新規登録
              this.addPeer(payloadObject.data);
              // 自身のmeObjectを返送
              this.sendPayload('info', 'system', this.me);
              break;
            case 'info': // meObject受信
              // 対象（すでにルームにいたピア）を新規登録または更新
              this.addPeer(payloadObject.data);
              // ルームの公開状態が未確定のとき（既存のルームに入室し かつ infoの初回受信）
              if (this.is_public === null) {
                // このコンポーネントの公開状態フラグを変更
                this.is_public = payloadObject.data.room.public;
                // meObjectのルーム公開状態を変更
                this.$store.commit('setMyRoomIsPublic', this.is_public);
                // 公開ルーム かつ 再入室ではない 場合のみ親コンポーネントに通知（Dashboardのsyncを実行し公開ルームに入室したことを全体通知）
                if (this.is_public === true && this.me.room.rejoin !== true) this.$emit('sync');
                // dump
                if (this.develop_mode && this.me.room.rejoin !== true) {
                  if (this.is_public === true)  console.log('"'+this.me.room.name+'" は公開ルームです');
                  if (this.is_public === false) console.log('"'+this.me.room.name+'" は限定ルームです'); 
                }
              }
              break;
          }
        }
      });
    },

    // SkyWay:ルームから退出する
    close() {
      if (this.not_send_my_leaving) {
        // 一時的な退室（あとですぐ再入室する）
        // チャットを退避させる
        this.$store.commit('storeChatLog', this.chat_payloads);
      } else {
        // 通常の退室
        // 自分が退室したことをチャットに送る
        this.sendPayload(this.me.name+'さんが退室しました', 'bot');
      }
      // 自分が退室（closeメソッド使用後に自動で発火）
      this.skywayroom.once('close', () => {
        // 親コンポーネントに通知（Dashboardのsyncを実行し公開ルームから退出したことを全体通知）
        // この関数が発火した時点でVuexのルームオブジェクトは空になっているのでsync送信データは常に未入室となる
        // 再入室の場合は送らない
        if (!this.not_send_my_leaving) {
          this.$emit('sync');
          if (this.develop_mode) console.log('ルーム "' + this.skywayroom.name + '" から退室しました');
        }
      });
      // このあとon.closeイベントが発火してそのハンドラ内で実際に退出
      this.skywayroom.close();
    },

    // ルーム内におけるデータ全般の送信
    // type = user/speech/qr/system
    // type = qr のとき additional_data = [ IMAGE DATA URL ]
    // type = system のとき message = join / info , additional_data = meObject (this.meと同じ)
    sendPayload: function(message, type = 'user', additional_data = null) {
      if (!this.skywayroom) return; // ルームタイプ自動切替のときにnullの場合がある
      const payloadObject = {
        id: this.me.id,
        name: this.me.name,
        icon: this.me.icon_url,
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