<template>
  <v-container>

    <!-- ダッシュボード上部に常駐する部分 -->
    <v-card outlined>
      <v-row justify="center" align="center" dense>
        <v-col cols="auto" class="ma-2" v-show="!shrink">
          <v-responsive>
            <video id="my-video-dashboard" :srcObject.prop="local_media_stream" muted autoplay playsinline></video>
            <div style="position:absolute;top:0px;left:0px;width:100%;height:100%;">
              <canvas id="my-wave-dashboard" style="width:100%;height:100%;"></canvas>
            </div>
          </v-responsive>
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
            <v-btn outlined small class="ma-1" :color="(video_muted) ? 'grey' : 'deep-orange darken-2'" @click="video_muted = !video_muted"><v-icon>mdi-video{{ (video_muted ? '-off' : '') }}</v-icon>映像</v-btn>
            <v-btn outlined small class="ma-1" :color="(audio_muted) ? 'grey' : 'green darken-1'" @click="audio_muted = !audio_muted"><v-icon>mdi-microphone{{ (audio_muted ? '-off' : '') }}</v-icon>音声</v-btn>
            <v-btn outlined small class="ma-1" color="indigo darken-4" @click.stop="config_dialog = true"><v-icon>mdi-account-cog</v-icon>設定</v-btn>
            <v-btn outlined small class="ma-1" color="pink darken-1" @click="logout"><v-icon>mdi-exit-run</v-icon>ログアウト</v-btn>
          </v-row>
        </v-col>
      </v-row>
    </v-card>


    <!-- 設定ダイアログ（smサイズ以下でフルスクリーン化） -->
    <v-dialog v-model="config_dialog" max-width="640" :fullscreen="$vuetify.breakpoint.smAndDown">
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
          <v-btn icon large color="black" @click="config_dialog = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-list-item>

        <v-divider></v-divider>

        <v-card-text class="mt-2">
          利用したいカメラ・マイクを選択してください。<br>
          使用可否を求めるダイアログが表示された場合は「許可」をクリックしてください。
        </v-card-text>

        <v-row justify="center" dense class="mx-1">

          <v-col cols="6">
            <v-select v-model="selectedVideo" :items="video_devices" label="映像入力" @change="onChangeLocalDevice" :disabled="video_muted" class="mt-2"></v-select>
            <v-select v-model="selectedAudio" :items="audio_devices" label="音声入力" @change="onChangeLocalDevice" :disabled="audio_muted" class="mt-n2"></v-select>
            <v-switch v-model="speech_onoff"  :label="`音声認識：${(!speech_available)?'利用不可':(speech_onoff)?'有効':'無効'}`" :disabled="!speech_available" class="mt-n2"></v-switch>
          </v-col>

          <v-col cols="6">
            <v-responsive>
              <video id="my-video-dialog" :srcObject.prop="local_media_stream" muted autoplay playsinline></video>
              <div style="position:absolute;top:0px;left:0px;width:100%;height:100%;">
                <canvas id="my-wave-dialog" style="width:100%;height:100%;"></canvas>
              </div>
            </v-responsive>
          </v-col>

        </v-row>

        <v-row class="pa-2" justify="center">
          <v-btn outlined class="ma-2" :color="(video_muted) ? 'grey' : 'deep-orange darken-2'" @click="video_muted = !video_muted">映像:{{ (video_muted ? 'オフ' : 'オン') }}</v-btn>
          <v-btn outlined class="ma-2" :color="(audio_muted) ? 'grey' : 'green darken-1'" @click="audio_muted = !audio_muted">音声:{{ (audio_muted ? 'オフ' : 'オン') }}</v-btn>
        </v-row>

        <!-- フルスクリーン時のみ補助ボタン（閉ボタン） -->
        <v-divider v-if="$vuetify.breakpoint.smAndDown"></v-divider>
        <v-row v-if="$vuetify.breakpoint.smAndDown" class="pa-2" justify="center">
          <v-btn dark class="ma-2" color="indigo darken-4" @click="config_dialog = false">設定を閉じる</v-btn>
        </v-row>

      </v-card>
    </v-dialog>

    <v-dialog v-model="permission_dialog" max-width="300" persistent>
      <v-card>
        <v-card-text class="pt-3" justify="center">
          <v-btn outlined class="ma-2" color="blue" @click="permission_dialog = false; onChangeLocalDevice();">カメラ・マイクを利用する</v-btn><br>
          ボタンをクリックするとポップアップが表示されますので「許可」をクリックしてください。
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>


<script>
export default {
  name: 'MyInfo',

  props: {
    me: {
      type: Object,
      required: true,
    },
    shrink: {
      type: Boolean,
      required: false,
      default: false,
    },
  },

  data() {
    return {
      config_dialog: true, // ダイアログは最初に必ず開く
      permission_dialog: false,
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
      audio_muted: false,
      video_muted: false,
      speech_available: false,
    }
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
      this.onChangeLocalDevice();
    } else {
      // 未許可または拒否の場合はとりあえずダイアログを出す
      // このダイアログ内のボタンを明示的に押してonChangeLocalDeviceを発火させる
      this.permission_dialog = true;
    }
  },

  updated: async function() {
    // 音声認識が利用できるかどうか（WebSpeechAPIの対応状況・マイクの利用許可確認）
    window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    this.speech_available = (await this.mic_allowed() && 'SpeechRecognition' in window && this.local_media_stream.getAudioTracks().length);
  },

  methods: {
    // 映像・音声デバイスが変更されたら発火
    onChangeLocalDevice: async function() {
      // 映像デバイスの細かな指定
      let constraint_video;
      if (this.selectedVideo && !this.video_muted) {
        // facingModeによる指定
        if (this.selectedVideo == 'environment') constraint_video = { facingMode: { exact: 'environment' } };
        else if (this.selectedVideo == 'user') constraint_video = { facingMode: 'user' };
        // deviceIdによる指定
        else constraint_video = { deviceId: this.selectedVideo };
      } else {
        // デバイスを使用しない
        constraint_video = false;
      }
      // デバイス指定（どっちもfalseだとだめらしい）
      const constraints = {
        audio: (this.selectedAudio && !this.audio_muted) ? { deviceId: this.selectedAudio } : false,
        video: constraint_video,
      };
      // ストリームは空白状態では何も送信しない（受信専用ピアになる）
      let mystream = new MediaStream();
      try {
        mystream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        if (e instanceof TypeError) console.log('いずれのMediaも有効になっていないため受信専用モードになりました');
        if (e instanceof DOMException) alert('デバイスの利用が許可されませんでした。メディアは受信専用でテキスト送受信のみ可能となります。');
        if (e instanceof OverconstrainedError) alert('指定のカメラはこの端末では利用できません。別のカメラを選択してください。');
      } finally {
        // ストリームを設定（ルーム接続中なら自動でreplaceされる）
        this.setLocalMediaStream(mystream);
        // ビデオエリアの横幅を取得する
        const video_tracks = mystream.getVideoTracks();
        const video_element_dashboard = document.getElementById('my-video-dashboard');
        const video_element_dialog    = document.getElementById('my-video-dialog');
        let wave_dashboard_width  = video_element_dashboard.offsetWidth;
        let wave_dashboard_height = video_element_dashboard.offsetHeight;
        let wave_dialog_width  = video_element_dialog.offsetWidth;
        let wave_dialog_height = video_element_dialog.offsetHeight;
        // 縦幅は実際のビデオの有無で計算する（大抵は4:3）
        if (mystream && video_tracks[0]) {
          // ビデオトラックがある場合：getSettings()で色々情報がとれる（その他、アスペクト比やフレームレートなど）
          const video_track = video_tracks[0].getSettings();
          wave_dashboard_height = wave_dashboard_width * video_track.height / video_track.width;
          wave_dialog_height    = wave_dialog_width * video_track.height / video_track.width;
        }
        // 波形表示を開始
        this.drawMicWave(mystream, 'my-wave-dashboard', wave_dashboard_width, wave_dashboard_height, 15);
        this.drawMicWave(mystream, 'my-wave-dialog',    wave_dialog_width,    wave_dialog_height,    15);
      }
    },

    // 自分のメディアストリームの設定と削除
    setLocalMediaStream(stream) {
      // 以前のストリームが存在する場合は破棄してから新しくセットする
      this.destroyLocalMediaStream();
      this.$set(this, 'local_media_stream', stream);
      // 親コンポーネントへイベント送出
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
    drawMicWave: function(stream, canvas_id, canvas_width, canvas_height, fps = 30) {
      // 音声ストリームが存在しない場合は描画しない
      if (!stream || stream.getAudioTracks().length == 0) return;
      //
      const audioctx = new (window.AudioContext || window.webkitAudioContext)();
      const input = audioctx.createMediaStreamSource(stream);
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
      const ctx = canvas.getContext('2d');
      canvas.setAttribute("width", canvas_width);
      canvas.setAttribute("height", canvas_height);
      
      // 描画処理
      function draw() {
        // ---- 処理開始 ----
        const begin = Date.now();
        // データ取得
        analyser.getByteTimeDomainData(dataArray);
        // キャンバスクリア
        ctx.clearRect(0, 0, canvas_width, canvas_height);
        ctx.fillStyle = 'rgba(200, 200, 200, 0.0)';
        ctx.fillRect(0, 0, canvas_width, canvas_height);
        // 波形線
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        const sliceWidth = canvas_width * 1.0 / bufferLength;
        let x = 0;
        //
        for (let i = 0; i < bufferLength; i++) {
          const level = dataArray[i] / 128.0; // Uint8 = 0 ~ 255
          const y = level * canvas_height/2;
          if (i == 0) ctx.moveTo(x, y);
          else        ctx.lineTo(x, y);
          x += sliceWidth;          
        }
        // 波形描画
        ctx.lineTo(canvas_width, canvas_height/2);
        ctx.stroke();
        // ---- 処理ここまで ----
        // fpsにあわせて次回の描画タイミングをセット
        const delay = 1000/fps - (Date.now() - begin);
        setTimeout(draw, delay);
      }
      // 描画開始
      setTimeout(draw, 0);
    },

    // カメラ・マイクそれぞれのPermissionがgrantedかどうか
    cam_allowed: async function() {
      const cam = await navigator.permissions.query({name: 'camera'});
      // granted/prompt/denied
      return (cam.state == 'granted');
    },
    mic_allowed: async function() {
      const mic = await navigator.permissions.query({name: 'microphone'});
      // granted/prompt/denied
      return (mic.state == 'granted');
    },

    // ログアウトする
    logout: function() {
      this.destroyLocalMediaStream();
      // store/index.jsのactionsでLINEログアウト処理などを行ったのち状態変数をログアウトに
      this.$store.dispatch('logout');
    },
  },

  computed: {
    speech_onoff: {
      get() { return this.$store.state.config.speech_recognition },
      set(onoff) {
        // 音声トラックがあれば設定に反映させる
        if (this.local_media_stream.getAudioTracks().length) this.$store.commit('speechConfig', onoff);
      },
    },
  },

  watch: {
    // 映像・音声のミュート
    video_muted: function(state) { this.onChangeLocalDevice() },
    audio_muted: function(state) {
      this.onChangeLocalDevice();
      // 音声を消したときのみ音声認識を連動して無効にする（ミュート解除に連動して有効化はしない）
      if (state) this.speech_onoff = false;
    },
  },
}
</script>


<style lang="scss">
#my-video-dashboard {
  background-color: #A0A0A0;
  height: 10vh;
  width: auto;
}
#my-video-dialog {
  background-color: #A0A0A0;
  width: 100%;
  height: auto;
}
</style>