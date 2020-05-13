import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    login_status: false,
    user_info: {
      name: '',
      icon_url: '',
      status: 'オフライン',
      room: '', // 末尾2文字："_S"ならSFU・"_M"ならMESH（オブジェクトだとリアクティブにならないため暫定対応）
    },
    in_line_app: false,
    local_media_stream: '',
    skyway: {
      peer: '',
      room: '',
    },
  },
  mutations: {
    // 引数は配列：ユーザー名・アイコンURL・状態文字列
    login(state, user_info) {
      state.login_status = true;
      state.user_info.name = user_info[0];
      state.user_info.icon_url = user_info[1];
      state.user_info.status = user_info[2];
    },
    setUserStatus(state, user_status) { state.user_info.status = user_status },
    setJoinedRoom(state, room) {
      // 処理注意（引数はオブジェクト・state変更は単一の文字列）
      if (room.type.toLowerCase() == 'sfu') {
        // SFUルームは末尾が"_S"
        state.user_info.room = room.name + '_S';
      } else {
        // MESHルームは末尾が"_M"（デフォルト）
        state.user_info.room = room.name + '_M';
      }
    },
    clearJoinedRoom(state) { state.user_info.room = '' },
    setIsInLineApp(state, tf) { state.in_line_app = tf },
    setLocalMediaStream(state, stream) {
      // ルーム接続状態であれば先にreplaceする
      if (state.skyway.room != '') state.skyway.room.replaceStream(stream);
      // 以前のストリームが存在する場合は破棄してから新しくセットする
      this.commit('destroyLocalMediaStream');
      state.local_media_stream = stream;
    },
    destroyLocalMediaStream(state) {
      if (state.local_media_stream != '') {
        state.local_media_stream.getTracks().forEach(track => {
          // 存在するトラックを1つずつ停止してから削除する（必要ないかも？）
          track.stop();
          state.local_media_stream.removeTrack(track);
        });
      }
    },
    logout(state) {
      state.login_status = false;
      state.user_info.name = '';
      state.user_info.icon_url = '';
      state.user_info.status = 'ログアウトしました';
      state.user_info.room = '';
    },
  },
  getters: {
  },
  actions: {
    async logout(context) {
      // LINEのログイン状態を確認
      await liff.init({
        liffId: process.env.VUE_APP_LIFF_ID
      }, data => {
        if (liff.isLoggedIn()) liff.logout();
      }, err => {
        console.log('LINEからのログアウトに失敗しました：', err.code);
      });
      // ここで状態変更
      context.commit('logout');
    },
  },
  modules: {
  }
})
