import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    debug: false,
    logged_in: false,
    me: {
      id: '',
      name: '',
      icon_url: '',
      status: 'オフライン',
      room: {
        name: '',
        type: '',
      },
    },
    meObject: { id: '', name: '', icon_url: '', status: '', room: {name: '', type: ''} },
    in_line_app: false,
    // メディアストリーム
    local_media_stream: null,
    remote_streams: {},
    // skyway共通クラス
    skyway: {
      peer: '',
      room: '',
    },
    // ピアに関するリスト（自身も含まれる）
    // 中身はmeObject
    peers: {},
  },

  getters: {
    emptyMeObject: state => { return Object.assign({}, state.meObject) },
  },

  mutations: {
    // 引数は配列：ユーザー名・アイコンURL・状態文字列
    login(state, me) {
      state.logged_in = true;
      state.me.name = me[0];
      state.me.icon_url = me[1];
      state.me.status = me[2];
    },

    // SkyWayサーバの接続前後でピアIDを更新
    _setMyPeerId(state, peer_id) {
      state.me.status = 'オンライン - ' + peer_id;
      state.me.id = peer_id;
    },
    _clearMyPeerId(state) {
      state.me.status = 'オフライン';
      state.me.id = '';
    },

    // ルームに入る時の引数は {name: ルーム名, type: meshまたはsfu}
    _setMyRoom(state, newroom) { Vue.set(state.me, 'room', newroom) },
    _clearMyRoom(state) { Vue.set(state.me, 'room', { name: '', type: '' }) },

    setIsInLineApp(state, tf) { state.in_line_app = tf },

    // 自分のメディアストリームの設定と削除
    setLocalMediaStream(state, stream) {
      // 以前のストリームが存在する場合は破棄してから新しくセットする
      this.commit('destroyLocalMediaStream');
      state.local_media_stream = stream;
    },
    destroyLocalMediaStream(state) {
      if (state.local_media_stream) {
        state.local_media_stream.getTracks().forEach(track => {
          // 存在するトラックを1つずつ停止してから削除する（必要ないかも？）
          track.stop();
          state.local_media_stream.removeTrack(track);
        });
      }
      state.local_media_stream = null;
    },

    // ルーム内のStreamの追加・削除
    addRemoteStream(state, mediaStreamObject) { Vue.set(state.remote_streams, mediaStreamObject.peerId, mediaStreamObject) },
    removeRemoteStream(state, remoteId) { Vue.delete(state.remote_streams, remoteId) },
    removeAllRemoteStreams(state) { Vue.set(state, 'remote_streams', {}) },

    // ピア状態を更新
    updatePeer(state, meObject) { Vue.set(state.peers, meObject.id, meObject) },
    removePeer(state, pid) { Vue.delete(state.peers, pid) },
    _updateMeInPeers(state) { Vue.set(state.peers, state.me.id, state.me) },
    _removeAllPeers(state) { Vue.set(state, 'peers', {}) },

    // 自身のデータをクリア
    _logout(state) {
      state.logged_in = false;
      state.me = Object.assign({}, state.meObject);
      state.me.status = 'ログアウト';
    },
  },

  actions: {
    // meObject:シグナリングでピアIDがとれているか
    setMyPeerId(context, peer_id) {
      context.commit('_setMyPeerId', peer_id);
      context.commit('_updateMeInPeers');
    },
    clearMyPeerId(context) {
      context.commit('_clearMyPeerId');
      context.commit('_updateMeInPeers');
    },

    // meObject:ルーム入退室
    setMyRoom(context, newroom) {
      context.commit('_setMyRoom', newroom);
      context.commit('_updateMeInPeers');
    },
    clearMyRoom(context) {
      context.commit('_clearMyRoom');
      context.commit('_updateMeInPeers');
    },

    // ログアウト操作
    async logout(context) {
      // ストリーム停止（カメラとマイクを切る）
      context.commit('destroyLocalMediaStream');
      // LINEのログイン状態を確認
      await liff.init({
        liffId: process.env.VUE_APP_LIFF_ID
      }, data => {
        if (liff.isLoggedIn()) liff.logout();
      }, err => {
        console.log('LINEからのログアウトに失敗しました：', err.code);
      });
      // ここで状態変更
      context.commit('_logout');
      context.commit('_removeAllPeers');
    },
  },

  modules: {
  }
})
