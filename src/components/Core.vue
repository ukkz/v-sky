<template>
  <v-container>

    <!-- ダッシュボード上部に常駐する部分 -->
    <v-card outlined>
      <v-row justify="center" align="center" dense>
        <v-col cols="2" class="ma-1" v-show="!shrink">
          <div id="vf-dashboard" class="vf">
            <video :srcObject.prop="local_media_stream" muted autoplay playsinline></video>
            <canvas id="miclevel-dashboard"></canvas>
          </div>
        </v-col>
        <v-col cols="auto">
          <v-row justify="center" align="center" class="my-2" v-show="!shrink">
            <v-avatar color="indigo" size="32">
              <v-icon v-if="!me.icon_url" dark>mdi-account-circle</v-icon>
              <img v-else :src="me.icon_url">
            </v-avatar>
            <h3 class="mx-2">{{ me.name }} さん</h3>
          </v-row>
          <v-row justify="center" class="my-2">
            <v-btn outlined small class="ma-1" :color="(video_muted) ? 'grey' : 'deep-orange darken-2'"
              @click="video_muted = !video_muted">
              <v-icon>mdi-video{{ (video_muted ? '-off' : '') }}</v-icon>{{ ($vuetify.breakpoint.xs) ? '' : '映像' }}</v-btn>
            <v-btn outlined small class="ma-1" :color="(audio_muted) ? 'grey' : 'green darken-1'"
              @click="audio_muted = !audio_muted">
              <v-icon>mdi-microphone{{ (audio_muted ? '-off' : '') }}</v-icon>{{ ($vuetify.breakpoint.xs) ? '' : '音声' }}</v-btn>
            <v-btn outlined small class="ma-1" color="indigo darken-4"
              @click.stop="config_dialog_open = true" v-if="!$store.state.config.onestep_mode">
              <v-icon>mdi-cog</v-icon>{{ ($vuetify.breakpoint.xs) ? '' : '設定' }}</v-btn>
            <v-btn outlined small class="ma-1" color="pink darken-1"
              @click="logout" v-if="!$store.state.config.onestep_mode">
              <v-icon>mdi-exit-run</v-icon>{{ ($vuetify.breakpoint.xs) ? '' : 'ログアウト' }}</v-btn>
          </v-row>
        </v-col>
      </v-row>
    </v-card>


    <!-- 設定ダイアログ（smサイズ以下でフルスクリーン化） -->
    <v-dialog v-model="config_dialog_open" max-width="640" :fullscreen="$vuetify.breakpoint.smAndDown">
      <v-card>
        <v-list-item>
          <v-list-item-avatar color="indigo">
            <v-icon v-if="!me.icon_url" dark>mdi-account-circle</v-icon>
            <img v-else :src="me.icon_url">
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title class="headline">{{ me.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ me.status }}</v-list-item-subtitle>
          </v-list-item-content>
          <v-btn icon large color="black" @click="config_dialog_open = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-list-item>

        <v-divider></v-divider>

        <!-- 1stepモード時 -->
        <v-card-text class="mt-2" v-if="$store.state.config.onestep_mode">
          以下に、正常に映像が表示されているかご確認ください。<br>
          問題がなければ右上の×ボタンを押してこのダイアログを閉じ、相手から着信があるまでそのままお待ちください。
        </v-card-text>

        <!-- 通常モード時 -->
        <v-card-text class="mt-2" v-if="!$store.state.config.onestep_mode">
          利用したいカメラ・マイクを選択してください。<br>
          使用可否を求めるダイアログが表示された場合は「許可」をクリックしてください。
        </v-card-text>

        <v-row justify="center" dense class="mx-1">

          <v-col cols="6" v-if="!$store.state.config.onestep_mode">
            <v-select v-model="selectedVideo" :items="video_devices" label="映像入力" @change="onChangeLocalDevice" class="mt-2"></v-select>
            <v-select v-model="selectedAudio" :items="audio_devices" label="音声入力" @change="onChangeLocalDevice" class="mt-n2"></v-select>
            <v-switch v-model="qr_onoff"      :label="`QR認識：${(!qr_available)?'利用不可':(qr_onoff)?'有効':'無効'}`" :disabled="!qr_available" class="mt-n2"></v-switch>
            <v-switch v-model="speech_onoff"  :label="`音声認識：${(!speech_available)?'利用不可':(speech_onoff)?'有効':'無効'}`" :disabled="!speech_available" class="mt-n2"></v-switch>
          </v-col>

          <v-col cols="6">
            <div id="vf-dialog" class="vf">
              <video :srcObject.prop="local_media_stream" muted autoplay playsinline></video>
              <canvas id="miclevel-dialog"></canvas>
            </div>
          </v-col>

        </v-row>

        <v-row class="pa-2" justify="center">
          <v-btn outlined class="ma-2" :color="(video_muted) ? 'grey' : 'deep-orange darken-2'" @click="video_muted = !video_muted">映像:{{ (video_muted ? 'オフ' : 'オン') }}</v-btn>
          <v-btn outlined class="ma-2" :color="(audio_muted) ? 'grey' : 'green darken-1'" @click="audio_muted = !audio_muted">音声:{{ (audio_muted ? 'オフ' : 'オン') }}</v-btn>
        </v-row>

        <!-- フルスクリーン時のみ補助ボタン（閉ボタン） -->
        <v-divider v-if="$vuetify.breakpoint.smAndDown"></v-divider>
        <v-row v-if="$vuetify.breakpoint.smAndDown" class="pa-2" justify="center">
          <v-btn dark class="ma-2" color="indigo darken-4" @click="config_dialog_open = false">設定を閉じる</v-btn>
        </v-row>

      </v-card>
    </v-dialog>

    <v-dialog v-model="permission_dialog_open" max-width="300" persistent>
      <v-card>
        <v-card-text class="pt-3" justify="center">
          <v-btn outlined class="ma-2" color="blue" @click="permission_dialog_open = false; onChangeLocalDevice();">カメラ・マイクを利用する</v-btn><br>
          ボタンをクリックするとポップアップが表示されますので「許可」をクリックしてください。
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>


<script>
export default {
  name: 'Core',

  props: {
    shrink: {
      type: Boolean,
      required: false,
      default: false,
    },
  },

  data() {
    return {
      config_dialog_open: false, // 設定ダイアログを最初に自動で開くかどうかはcreatedで判断
      permission_dialog_open: false,
      audio_devices: [
        {
          text: '使用しない',
          value: '',
        },
      ],
      video_devices: [
        {
          text: '自分撮りカメラ優先',
          value: 'user',
        },
        {
          text: '外側カメラ優先',
          value: 'environment',
        },
        {
          text: '使用しない',
          value: '',
        },
      ],
      selectedAudio: '',
      selectedVideo: '',
      local_media_stream: (new MediaStream()), // 直接変更禁止
      miclevel_animation_id: null,
      miclevel_abort_flag: false, // 直接変更禁止
      speech_available: false,
      qr_available: false,
    }
  },

  created() {
    // ログインチェック（ルーターでliff.init実行済）
    const guest_name = sessionStorage.getItem('guest');
    if (guest_name) {
      // guestパラメータが設定されていればその名前でゲストログイン
      this.$store.commit('login', [guest_name, '', 'ゲスト - オフライン']);
    } else if (liff.isLoggedIn()) {
      // 通常はLINEのプロフィールでログイン
      liff.getProfile().then(profile => {
        // LINE内ブラウザで開いているかどうか記録
        this.$store.commit('setIsInLineApp', liff.isInClient());
        // ログイン状態を記録（ストアの状態変更のみ）
        this.$store.commit('login', [profile.displayName, profile.pictureUrl, 'LINEログイン完了 - オフライン']);
      }).catch((err) => {
        alert('LINEプロフィールの取得に失敗しました: '+err.code);
      })
    } else {
      // ログインが確認できなければログインページに戻す
      this.$router.push({ name: 'Login' });
    }
    // SkyWay Peer 初期化（オンラインステータスなどはここで更新）
    this.$store.dispatch('connectSkyWay');
    // ページセッションが2回目以降（used_deviceのキーがaudioもvideoもストレージ内に存在する）ならダイアログを開かない
    this.config_dialog_open = (sessionStorage.getItem('used_audio_device') && sessionStorage.getItem('used_video_device')) ? false : true;
    // 1stepモードのときはログイン時に常に開く
    if (this.$store.state.config.onestep_mode) this.config_dialog_open = true;
  },

  mounted: async function() {
    // デバイスを取得
    const deviceInfos = await navigator.mediaDevices.enumerateDevices();
    // マイク
    deviceInfos
      .filter(deviceInfo => deviceInfo.kind === 'audioinput')
      .map(audio => this.audio_devices.unshift({text: audio.label || `マイク ${this.audio_devices.length + 1}`, value: audio.deviceId}));
    // 最初にデバイスが存在すればデフォルトデバイスにする
    if (this.audio_devices[0]) this.selectedAudio = this.audio_devices[0];
    // カメラ
    deviceInfos
      .filter(deviceInfo => deviceInfo.kind === 'videoinput')
      .map(video => this.video_devices.unshift({text: video.label || `カメラ ${this.video_devices.length + 1}`, value: video.deviceId}));
    // 最初にデバイスが存在すればデフォルトデバイスにする
    if (this.video_devices[0]) this.selectedVideo = this.video_devices[0];

    // カメラとマイクのパーミッションを確認
    if (await this.cam_allowed() && await this.mic_allowed()) {
      // 許可済みの場合はそのままgetUserMedia
      await this.startLocalDevice();
    } else {
      // 未許可または拒否の場合はとりあえずダイアログを出す
      // このダイアログ内のボタンを明示的に押してonChangeLocalDeviceを発火させる
      this.permission_dialog_open = true;
    }
  },

  updated: async function() {
    // 音声認識が利用できるかどうか（WebSpeechAPIの対応状況・マイクの利用許可確認）
    window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    this.speech_available = (await this.mic_allowed() && 'SpeechRecognition' in window && this.local_media_stream.getAudioTracks().length);
    // QRが利用できるかどうか（ビデオトラックが最低1つあればOK）
    this.qr_available = (await this.cam_allowed() && this.local_media_stream.getVideoTracks().length);
  },

  methods: {
    // ページロード直後の最初にメディアストリームの取得を試みる
    startLocalDevice: async function() {
      const used_audio_device = sessionStorage.getItem('used_audio_device');
      const used_video_device = sessionStorage.getItem('used_video_device');
      // Storageは保存されていない（キー未定義）であればundefinedではなくnullとなる
      if (used_audio_device !== null && used_video_device !== null) {
        // エラーの出なかったデバイスがあればそれを選択済みにする
        this.selectedAudio = JSON.parse(used_audio_device);
        this.selectedVideo = JSON.parse(used_video_device);
      }
      // 通常どおりのgetUserMedia
      await this.onChangeLocalDevice();
    },

    // 映像・音声デバイスが変更されたら発火
    onChangeLocalDevice: async function() {
      // 映像デバイスの細かな指定
      let constraint_video;
      if (this.selectedVideo) {
        // facingModeによる指定
        if (this.selectedVideo == 'environment') constraint_video = { facingMode: { exact: 'environment' } };
        else if (this.selectedVideo == 'user') constraint_video = { facingMode: 'user' };
        // deviceIdによる指定
        else constraint_video = { deviceId: this.selectedVideo };
      } else {
        // 「使用しない」はこっち
        constraint_video = false;
      }
      // デバイス制約
      const new_constraints = {
        audio: (this.selectedAudio) ? { deviceId: this.selectedAudio } : false,
        video: constraint_video,
      };
      // ストリームは空白状態では何も送信しない（受信専用ピアになる）
      let mystream = new MediaStream();
      try {
        // デバイスからメディア取得を試みる
        mystream = await navigator.mediaDevices.getUserMedia(new_constraints); // デバイスが取得できないときはここでエラー
        // 正常に取得できていればページセッション中は利用デバイスを保持（ビデオ不使用でキープできたりする）
        sessionStorage.setItem('used_audio_device', JSON.stringify(this.selectedAudio));
        sessionStorage.setItem('used_video_device', JSON.stringify(this.selectedVideo));
        // ストリームを設定（ルーム接続中なら自動でreplaceされる）
        this.setLocalMediaStream(mystream);
      } catch (e) {
        if (e instanceof TypeError) {
          // audioもvideoもfalseだった場合は空ストリームを送る受信モードにする
          console.log('いずれのMediaも有効になっていないため受信専用モードになりました');
          this.setLocalMediaStream( new MediaStream() );
          sessionStorage.setItem('used_audio_device', JSON.stringify(this.selectedAudio));
          sessionStorage.setItem('used_video_device', JSON.stringify(this.selectedVideo));
        } else {
          if (e instanceof DOMException) alert('デバイスの利用が許可されませんでした。メディアは受信専用でテキスト送受信のみ可能となります。');
          if (e instanceof OverconstrainedError) alert('指定のカメラ/マイクはこの端末では利用できません。別のカメラ/マイクを選択してください。');
        }
      } finally {
        // 波形表示を開始（または再開）
        this.$nextTick(() => this.startMicLevelAnimation((this.config_dialog_open) ? 'miclevel-dialog' : 'miclevel-dashboard'));
      }
    },

    // 自分のメディアストリームの設定と削除
    setLocalMediaStream(stream) {
      // 以前のストリームが存在する場合は破棄してから新しくセットする
      this.destroyLocalMediaStream();
      this.$set(this, 'local_media_stream', stream);
      // 映像または音声のトラックが無いときのみミュートにする（逆はしない）
      if (!stream.getAudioTracks()[0]) this.audio_muted = true;
      if (!stream.getVideoTracks()[0]) this.video_muted = true;
      // 実際のストリームに対してミュート状態を再適用
      stream.getAudioTracks().forEach(t => t.enabled = !this.audio_muted);
      stream.getVideoTracks().forEach(t => t.enabled = !this.video_muted);
      // 親コンポーネントへイベント送出（ルームなどで利用しているストリームの更新）
      this.$emit('changeStream', this.local_media_stream);
    },
    destroyLocalMediaStream() {
      this.local_media_stream.getTracks().forEach(track => {
        // 存在するトラックを1つずつ停止してから削除する（必要ないかも？）
        track.stop();
        this.local_media_stream.removeTrack(track);
      });
      this.$set(this, 'local_media_stream', (new MediaStream()));
    },

    // マイク入力波形描画
    startMicLevelAnimation: function(canvas_id) {
      // すでに開始している描画があれば止める
      if (this.miclevel_animation_id) cancelAnimationFrame(this.miclevel_animation_id);
      // 音声ストリームが存在しない場合は描画しない
      if (!this.local_media_stream || this.local_media_stream.getAudioTracks().length == 0) return;
      // 入力ソースとアナライザの準備
      const audioctx = new (window.AudioContext || window.webkitAudioContext)();
      const input = audioctx.createMediaStreamSource(this.local_media_stream);
      const analyser = audioctx.createAnalyser();
      // AudioNode(input) -> AnalyserNode(analyser) -> AudioDestinationNode(audioctx)
      input.connect(analyser);
      // 以下はコメント解除するとループバック（アナライザーからオーディオ出力）するのでハウる
      //analyser.connect(audioctx.destination);

      // アナライザ設定
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      // 波形表示対象のキャンバス
      const canvas = document.getElementById(canvas_id);
      if (!canvas) return; // 1stepですぐ退室する場合は描画不要のため呼ばれてもすぐに戻す
      const parent = canvas.parentNode;
      const canvas_width = parent.offsetWidth;
      const canvas_height = 100; // 実際の表示はCSSで親要素100%高に引き延ばされる
      canvas.setAttribute('width', canvas_width);
      canvas.setAttribute('height', canvas_height);
      // キャンバス操作
      const ctx = canvas.getContext('2d');
      
      // 描画処理
      let prev_level = 0;
      // ループ内変数
      let current_level, avg_level, bar_width;

      const draw = () => {
        // ---- 処理開始 ----
        // データ取得
        analyser.getByteTimeDomainData(dataArray);
        // キャンバスクリア
        ctx.clearRect(0, 0, canvas_width, canvas_height);
        // 信号の最大値を取得
        let max = 0; // 128 ~ 255
        for (let i = 0; i < bufferLength; i++) { if (dataArray[i] > max) max = dataArray[i]; }
        current_level = (max / 128.0) - 1;
        // 前回の値との平均値をだす
        avg_level = (current_level + prev_level) / 2;
        prev_level = current_level;
        // バーの太さは最低10px
        bar_width = 10 + (canvas_width / 50);
        // レベルメータを描画
        ctx.fillStyle = 'rgba(200, 20, 20, 0.7)';
        ctx.fillRect(0, (1 - avg_level) * canvas_height, bar_width, avg_level * canvas_height);
        // ---- 処理ここまで ----
        this.miclevel_animation_id = requestAnimationFrame(draw);
      }
      // 描画開始（初回）
      draw();
    },

    // カメラ・マイクそれぞれのPermissionがgrantedかどうか
    cam_allowed: async function() {
      if (!("permissions" in navigator)) return true;
      const cam = await navigator.permissions.query({name: 'camera'});
      // granted/prompt/denied
      return (cam.state == 'granted');
    },
    mic_allowed: async function() {
      if (!("permissions" in navigator)) return true;
      const mic = await navigator.permissions.query({name: 'microphone'});
      // granted/prompt/denied
      return (mic.state == 'granted');
    },

    // ログアウトする
    logout: function() {
      // セッションストレージ変数削除
      sessionStorage.clear();
      // メディアストリーム削除
      this.destroyLocalMediaStream();
      // store/index.jsのactionsでLINEログアウト処理などを行ったのち状態変数をログアウトに
      this.$store.dispatch('logout');
      // ログインページ
      if (this.$store.state.config.onestep_mode) {
        // 1stepモード
        this.$router.push({ path: '/login', query: { '1step': null } });
      } else {
        // 通常モード
        this.$router.push({ path: '/login' });
      }
    },
  },

  computed: {
    // 映像・音声のミュート
    video_muted: {
      get() { return this.$store.state.config.video_muted },
      set(onoff) {
        this.local_media_stream.getVideoTracks().forEach(video_track => video_track.enabled = !onoff);
        this.$store.commit('videoMute', onoff);
        // 映像を消したときのみQR認識を連動して無効にする（ミュート解除に連動して有効化はしない）
        if (onoff) this.qr_onoff = false;
      },
    },
    audio_muted: {
      get() { return this.$store.state.config.audio_muted },
      set(onoff) {
        this.local_media_stream.getAudioTracks().forEach(audio_track => audio_track.enabled = !onoff);
        this.$store.commit('audioMute', onoff);
        // 音声を消したときのみ音声認識を連動して無効にする（ミュート解除に連動して有効化はしない）
        if (onoff) this.speech_onoff = false;
      },
    },
    // 音声認識のオンオフ
    speech_onoff: {
      get() { return this.$store.state.config.speech_recognition },
      set(onoff) {
        // 音声トラックがあれば設定に反映させる
        if (this.local_media_stream.getAudioTracks().length) this.$store.commit('speechConfig', onoff);
      },
    },
    // QR認識のオンオフ
    qr_onoff: {
      get() { return this.$store.state.config.qr_recognition },
      set(onoff) {
        // 映像トラックがあれば設定に反映させる
        if (this.local_media_stream.getVideoTracks().length) this.$store.commit('qrConfig', onoff);
      },
    },
    // Vuex監視用
    me() { return this.$store.state.me },
  },

  watch: {
    // 設定ダイアログの開閉
    config_dialog_open: function(state) {
      // 現在表示しているほう（ダッシュボードまたはダイアログ）でレベルメータを再表示
      this.$nextTick(() => this.startMicLevelAnimation((state) ? 'miclevel-dialog' : 'miclevel-dashboard'));
    },
  },
}
</script>


<style lang="scss">
div#vf-dashboard {
  height: 10vh;
  width: auto;
  border-radius: 10px;
}
div#vf-dialog {
  width: 100%;
  height: 100%;
  min-height: 20vh;
  border-radius: 20px;
}
div.vf {
  position: relative;
  background-color: #050505;
  overflow: hidden;
}
div.vf video {
  position: absolute;
  top: 50%; left: 50%;
  transform: translateY(-50%) translateX(-50%) scale(-1, 1);
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}
div.vf canvas {
  position: absolute;
  top:0px; left:0px;
  width: 100%;
  height: 100%;
}
</style>