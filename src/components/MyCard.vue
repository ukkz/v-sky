<template>
  <v-card class="mx-auto">

    <v-list-item>
      <v-list-item-avatar color="indigo">
        <v-icon v-if="!mydata.icon_url" dark>mdi-account-circle</v-icon>
        <img v-else :src="mydata.icon_url">
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title class="headline">{{ mydata.display_name }}</v-list-item-title>
        <v-list-item-subtitle>{{ user_status }}</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <video class="video-stream" :srcObject.prop="$store.state.local_media_stream" muted autoplay playsinline></video>

    <v-card-text>
      <v-row justify="center" align="baseline">
        <v-col cols="1" @click="video_muted = !video_muted"><v-icon>mdi-video{{ (video_muted ? '-off' : '') }}</v-icon></v-col>
        <v-col cols="11"><v-select v-model="selectedVideo" :items="video_devices" label="映像入力" @change="onChangeDevice" :disabled="video_muted"></v-select></v-col>
      </v-row>
      <v-row justify="center" align="baseline">
        <v-col cols="1" @click="audio_muted = !audio_muted"><v-icon>mdi-microphone-variant{{ (audio_muted ? '-off' : '') }}</v-icon></v-col>
        <v-col cols="11"><v-select v-model="selectedAudio" :items="audio_devices" label="音声入力" @change="onChangeDevice" :disabled="audio_muted"></v-select></v-col>
      </v-row>
    </v-card-text>

    <v-card-actions>
      <v-btn outlined color="error" @click="logout">ログアウト</v-btn>
    </v-card-actions>

  </v-card>
</template>

<script>
export default {
  name: 'MyCard',

  props: {
    mydata: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      audio_devices: [],
      video_devices: [],
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
      .map(audio => this.audio_devices.push({text: audio.label || `マイク ${this.audio_devices.length + 1}`, value: audio.deviceId}));
    if (this.audio_devices[0]) this.selectedAudio = this.audio_devices[0]; // 初期デバイス
    // カメラ
    deviceInfos
      .filter(deviceInfo => deviceInfo.kind === 'videoinput')
      .map(video => this.video_devices.push({text: video.label || `カメラ ${this.video_devices.length - 1}`, value: video.deviceId}));
    if (this.video_devices[0]) this.selectedVideo = this.video_devices[0]; // 初期デバイス
    // 初期デバイスへの接続を試みる
    this.onChangeDevice();
  },

  methods: {
    // 映像・音声デバイスが変更されたら発火
    onChangeDevice: function() {
      if (this.selectedAudio && this.selectedVideo) this.connectLocalDevice();
    },

    // 有効な映像・音声デバイスが指定されたら自分のストリームとして表示
    connectLocalDevice: async function() {
      const constraints = {
        audio: this.selectedAudio ? { deviceId: this.selectedAudio } : false,
        video: this.selectedVideo ? { deviceId: this.selectedVideo } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.$store.commit('setLocalMediaStream', stream);
      // ルーム接続状態でデバイスが変更されたらストリームを付け替える
      this.$store.commit('replaceMyStream', stream);
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