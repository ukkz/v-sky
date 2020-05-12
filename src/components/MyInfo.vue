<template>
  <v-container fluid>

    <!-- ダッシュボード上部に常駐する部分 -->
    <v-card>
      <v-row justify="center" align="center" dense>
        <v-col cols="auto" v-if="!shrink" class="ma-2">
          <v-responsive>
            <video id="my-video-dashboard" :srcObject.prop="$store.state.local_media_stream" muted autoplay playsinline></video>
            <div style="position:absolute;top:0px;left:0px;width:100%;height:100%;">
              <canvas id="my-wave-dashboard" style="width:100%;height:100%;"></canvas>
            </div>
          </v-responsive>
        </v-col>
        <v-col cols="auto">
          <v-row justify="center" align="center" class="my-2">
            <v-avatar color="indigo" size="32">
              <v-icon v-if="!mydata.icon_url" dark>mdi-account-circle</v-icon>
              <img v-else :src="mydata.icon_url">
            </v-avatar>
            <h3 class="mx-2">{{ mydata.display_name }} さん</h3>
          </v-row>
          <v-row justify="center" class="my-2">
            <v-btn outlined small class="ma-1" color="green" @click="video_muted = !video_muted"><v-icon>mdi-video{{ (video_muted ? '-off' : '') }}</v-icon>映像</v-btn>
            <v-btn outlined small class="ma-1" color="green" @click="audio_muted = !audio_muted"><v-icon>mdi-microphone{{ (audio_muted ? '-off' : '') }}</v-icon>音声</v-btn>
            <v-btn outlined small class="ma-1" color="blue"  @click.stop="open = true"><v-icon>mdi-account-cog</v-icon>設定</v-btn>
            <v-btn outlined small class="ma-1" color="red"   @click="logout"><v-icon>mdi-logout</v-icon>ログアウト</v-btn>
          </v-row>
        </v-col>
      </v-row>
    </v-card>


    <!-- 設定ダイアログ -->
    <v-dialog v-model="open" max-width="640">
      <v-card>
        <v-list-item>
          <v-list-item-avatar color="indigo">
            <v-icon v-if="!mydata.icon_url" dark>mdi-account-circle</v-icon>
            <img v-else :src="mydata.icon_url">
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title class="headline">{{ mydata.display_name }}</v-list-item-title>
            <v-list-item-subtitle>{{ user_status }}</v-list-item-subtitle>
          </v-list-item-content>
          <v-btn icon large color="black" @click="open = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-list-item>

        <v-divider></v-divider>

        <v-card-text class="mt-2">
          利用したいカメラ・マイクを選択してください。<br>
          使用可否を求めるダイアログが表示された場合は「許可」をクリックしてください。
          <v-select v-model="selectedVideo" :items="video_devices" label="映像入力" @change="onChangeLocalDevice" :disabled="video_muted" class="mt-2"></v-select>
          <v-select v-model="selectedAudio" :items="audio_devices" label="音声入力" @change="onChangeLocalDevice" :disabled="audio_muted" class="mt-n2"></v-select>
          映像または音声が正常に取得できていれば以下に表示されます。
        </v-card-text>

        <v-row justify="center">
          <v-col cols="8">
            <v-responsive>
              <video id="my-video-dialog" :srcObject.prop="$store.state.local_media_stream" muted autoplay playsinline></video>
              <div style="position:absolute;top:0px;left:0px;width:100%;height:100%;">
                <canvas id="my-wave-dialog" style="width:100%;height:100%;"></canvas>
              </div>
            </v-responsive>
          </v-col>
        </v-row>

        <v-card-actions>
          <v-btn text class="ma-1" color="green" @click="video_muted = !video_muted">映像{{ (video_muted ? 'オフ' : 'オン') }}</v-btn>
          <v-btn text class="ma-1" color="green" @click="audio_muted = !audio_muted">音声{{ (audio_muted ? 'オフ' : 'オン') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>


<script>
export default {
  name: 'MyInfo',

  props: {
    shrink: {
      type: Boolean,
      required: false,
      default: false,
    },
    mydata: {
      type: Object,
      required: true,
    },
    /* MyDataオブジェクト
     * - display_name    : [String] 表示名
     * - icon_url        : [String] アイコン画像URL
     * - joined_room_name: [String] ルーム名
     * - joined_room_type: [String] 'mesh' or 'sfu'
    */
  },

  data() {
    return {
      open: true, // ダイアログは最初に必ず開く
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
      audio_muted: false,
      video_muted: false,
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
    // 良いか悪いかわからんけどロード直後にそのままgetUserMediaしてしまう（許可でるやつ）
    // PermissionAPIを使う？
    this.onChangeLocalDevice();
  },

  methods: {
    // 映像・音声デバイスが変更されたら発火
    onChangeLocalDevice: async function() {
      // すべてのトラックを一旦破棄する
      this.$store.commit('destroyLocalMediaStream');
      // 映像デバイスの細かな指定
      let constraint_video;
      if (this.selectedVideo) {
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
        audio: (this.selectedAudio) ? { deviceId: this.selectedAudio } : false,
        video: constraint_video,
      };
      // ストリームは空白状態では何も送信しない（受信専用ピアになる）
      let stream = '';
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        if (e instanceof TypeError) alert('映像入力と音声入力を両方とも使用しない場合、メディアは受信専用でテキスト送受信のみ可能となります。');
        if (e instanceof DOMException) alert('デバイスの利用が許可されませんでした。メディアは受信専用でテキスト送受信のみ可能となります。');
        if (e instanceof OverconstrainedError) alert('指定のカメラはこの端末では利用できません。別のカメラを選択してください。');
        console.log('デバイス選択エラー:', e);
      } finally {
        // ストリームをセット
        this.$store.commit('setLocalMediaStream', stream);
        // ルーム接続状態でデバイスが変更されたらストリームを付け替える
        this.$store.commit('replaceMyStream', stream);
        // ビデオエリアの横幅を取得する
        const video_tracks = stream.getVideoTracks();
        const video_element_dashboard = document.getElementById('my-video-dashboard');
        const video_element_dialog    = document.getElementById('my-video-dialog');
        let wave_dashboard_width  = video_element_dashboard.offsetWidth;
        let wave_dashboard_height = video_element_dashboard.offsetHeight;
        let wave_dialog_width  = video_element_dialog.offsetWidth;
        let wave_dialog_height = video_element_dialog.offsetHeight;
        // 縦幅は実際のビデオの有無で計算する（大抵は4:3）
        if (video_tracks[0]) {
          // ビデオトラックがある場合：getSettings()で色々情報がとれる（その他、アスペクト比やフレームレートなど）
          const video_track = video_tracks[0].getSettings();
          wave_dashboard_height = wave_dashboard_width * video_track.height / video_track.width;
          wave_dialog_height    = wave_dialog_width * video_track.height / video_track.width;
        }
        // 波形表示を開始
        this.drawMicWave(stream, 'my-wave-dashboard', wave_dashboard_width, wave_dashboard_height, 15);
        this.drawMicWave(stream, 'my-wave-dialog',    wave_dialog_width,    wave_dialog_height,    15);
      }
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
        ctx.lineWidth = 2;
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

    // ログアウトする
    logout: async function() {
      // SkyWay切断
      this.$store.state.skyway.peer.destroy();
      // ストリーム停止（カメラとマイクを切る）
      this.$store.commit('destroyLocalMediaStream');
      // ログアウト前処理
      // store/index.jsのactionsでLINEログアウト処理などを行ったのち状態変数をログアウトに
      this.$store.dispatch('logout');
      // computedとwatchで変数の変化を検出してLoginページに飛ばしている
    },
  },

  computed: {
    user_status() { return this.$store.state.user_info.status },
  },

  watch: {
    // 映像または音声のミュート
    audio_muted: function(state) { this.$store.state.local_media_stream.getAudioTracks().forEach(track => track.enabled = !state) },
    video_muted: function(state) { this.$store.state.local_media_stream.getVideoTracks().forEach(track => track.enabled = !state) },
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