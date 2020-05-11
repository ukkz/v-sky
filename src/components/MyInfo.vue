<template>
  <v-container fluid>

    <!-- ダッシュボード上部に常駐する部分 -->
    <v-card>
      <v-row justify="center" align="center" dense>
        <v-col cols="auto" v-if="!shrink" class="ma-2">
          <video id="my-video-dashboard" :srcObject.prop="$store.state.local_media_stream" muted autoplay playsinline></video>
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
    <v-dialog v-model="open" persistent max-width="640">
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

        <video id="my-video-dialog" :srcObject.prop="$store.state.local_media_stream" muted autoplay playsinline></video>

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
      }
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
}
</style>