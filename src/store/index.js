import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    develop_mode: (process.env.NODE_ENV == 'development'),
    // ログイン状態（ここの値を変えることでログイン・ログアウト制御）
    logged_in: false,
    // 自Peerの状態（他Peersと交換する）
    me: {
      id: '',
      name: '',
      icon_url: '',
      status: 'オフライン',
      room: {
        name: '',
        type: '',
        public: null,
      },
    },
    meObject: { id: '', name: '', icon_url: '', status: '', room: { name: '', type: '', public: null, } },
    // グローバルな設定変数
    config: {
      debug: false,
      speech_recognition: false,
      qr_recognition: false,
    },
    // SkyWay
    skyway: {
      apikey: process.env.VUE_APP_SKYWAY_APIKEY,
      peer: null,
      connections: {},
      public_peers: {},
    },
    //
    in_line_app: false,
  },

  getters: {
    emptyMeObject: state => { return Object.assign({}, state.meObject) },
    public_rooms(state) {
      // 返却値のベース：Mainは空室でも存在させる
      let room_list = {
        Main: {
          type: 'mesh',
          members: [],
          public: true,
        },
      };
      // ピアごとにルーム名を抽出する
      Object.keys(state.skyway.public_peers).forEach(id => {
        const name = state.skyway.public_peers[id].room.name;
        const type = state.skyway.public_peers[id].room.type;
        // ルーム名ごとに処理
        if (name == '') {
          // ルーム名が空白ならどこにも入室していないのでスキップ
          return;
        } else if (name in room_list) {
          // ルーム名のキーがすでにある
          room_list[name].members.push(id);
        } else {
          // ルーム名のキーがまだない
          room_list[name] = {
            type: type,
            members: [id],
            public: true,
          };
        }
      });
      return room_list;
    },
  },

  mutations: {
    // 引数は配列：ユーザー名・アイコンURL・状態文字列
    login(state, me) {
      state.logged_in = true;
      state.me.name = me[0];
      state.me.icon_url = me[1];
      state.me.status = me[2];
    },

    // SkyWay Peer
    _initPeer(state, peer) { Vue.set(state.skyway, 'peer', peer) },
    _killPeer(state) { state.skyway.peer.destroy(); Vue.set(state.skyway, 'peer', null) },
    // ピアリスト追加/削除
    _addPeer(state, peer_data) { Vue.set(state.skyway.public_peers, peer_data.id, peer_data.body) },
    _delPeer(state, target_id) { Vue.delete(state.skyway.public_peers, target_id) },
    // コネクションリスト追加/削除
    _addConnection(state, conn_data) { Vue.set(state.skyway.connections, conn_data.id, conn_data.body) },
    _delConnection(state, target_id) {
      Vue.delete(state.skyway.peer.connections, target_id); // Peer内部メンバも消去する
      Vue.delete(state.skyway.connections, target_id);
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
    setMyRoom(state, newroom) { Vue.set(state.me, 'room', newroom) },
    setMyRoomIsPublic(state, is_public) { Vue.set(state.me.room, 'public', is_public) },
    setMyRoomType(state, type) { Vue.set(state.me.room, 'type', type) },
    clearMyRoom(state) {
      Vue.set(state.skyway.peer, 'rooms', {}); // Peer内部メンバも消去する
      Vue.set(state.me, 'room', { name: '', type: '', public: null, });
    },

    // その他の設定変更
    speechConfig(state, onoff) { state.config.speech_recognition = onoff },
    qrConfig(state, onoff) { state.config.qr_recognition = onoff },

    setIsInLineApp(state, tf) { state.in_line_app = tf },

    // 自身のデータをクリア
    _logout(state) {
      state.logged_in = false;
      state.me = Object.assign({}, state.meObject);
      state.me.status = 'ログアウト';
    },
  },

  actions: {
    // SkyWay
    connectSkyWay(context) {
      if (context.state.skyway.peer !== null) return;
      // SkyWayのPeerを作成
      const peer = new Peer({
        key: context.state.skyway.apikey,
        debug: ((context.state.develop_mode) ? 2 : 0),
      });
      // openコールバック
      peer.on('open', myid => {
        // 自分のピアIDをセットしオンライン状態に
        context.commit('_setMyPeerId', myid);
        // Peer全てにコネクションを作って送信
        // ここでは最初のブロードキャストなので部屋に入っていても通知しない（直URLで入室したら先にroomに値が入っていたりする）
        const me_no_room = Object.assign({}, context.state.me, { room: {name: '', type: ''} });
        peer.listAllPeers(peers => {
          peers.forEach(pid => {
            if (pid == myid) return; // 自分のIDはスキップ
            const outgoingDC = peer.connect(pid, { serialization: 'json' });
            // 接続されたら自身のmeObjectを送信
            outgoingDC.once('open', () => {
              outgoingDC.send(me_no_room);
              if (context.state.develop_mode) console.log('syncAllPeers:', pid);
            });
          });
        });
      });
      // disconnectコールバック
      peer.on('disconnected', () => context.commit('_clearMyPeerId'));
      // データ接続コールバック
      peer.on('connection', incomingDC => {
        // 誰かからデータが来たとき
        incomingDC.on('data', anybody => {
          // ピア情報を追加または更新する
          context.commit('_addPeer', { id: incomingDC.remoteId, body: anybody });
          if (!(incomingDC.remoteId in context.state.skyway.connections)) {
            // 外向きのコネクションリストに存在しなければ作成・保存
            const outgoingDC = context.state.skyway.peer.connect(incomingDC.remoteId, { serialization: 'json' });
            outgoingDC.once('close', () => { if (context.state.develop_mode) console.log('既存ピア ' + incomingDC.remoteId + ' が切断されました') });
            outgoingDC.once('open', () => {
              if (context.state.develop_mode) console.log('新規ピア ' + incomingDC.remoteId + ' (' + anybody.name + ') と接続されました');
              if (context.state.me.room.public !== false) {
                // 未入室か公開ルームにいる場合（context.state.me.roomがtrueまたはnull）のみ返答する
                outgoingDC.send(context.state.me);
                if (context.state.develop_mode) console.log('次のデータを返送します:', context.state.me);
              } else {
                // 限定ルームにいる場合は返答しない
                if (context.state.develop_mode) console.log('ルーム公開状態 "' + String(context.state.me.room.public) + '" のため応答しませんでした');
              }
              // connectionsリストに追加する
              context.commit('_addConnection', { id: incomingDC.remoteId, body: outgoingDC });
            });
          } else {
            // すでにコネクションが保存済みならデータ更新のみ
            if (context.state.develop_mode) console.log('既存ピア ' + anybody.name + ' が更新されました - ルーム状態:', anybody.room.name);
          }
        });
        // 誰かとのデータコネクションが切断されたとき
        incomingDC.once('close', () => {
          if (incomingDC.remoteId in context.state.skyway.connections
            && context.state.skyway.connections[incomingDC.remoteId].open)
            context.state.skyway.connections[incomingDC.remoteId].close(true);
          context.commit('_delPeer', incomingDC.remoteId);
          context.commit('_delConnection', incomingDC.remoteId);
          if (context.state.develop_mode) console.log('既存ピア ' + incomingDC.remoteId + ' を削除しました');
        });
      });
      //
      context.commit('_initPeer', peer);
    },

    // ピアリストに登録済みのピアに自身の情報を送信
    sync(context) {
      // 保存されたデータコネクションから送る
      Object.keys(context.state.skyway.connections).forEach(remoteId => {
        const dc = context.state.skyway.connections[remoteId];
        if (dc.open) {
          // コネクションが開いたままのピアのみに送信する
          dc.send(context.state.me);
          if (context.state.develop_mode) {
            if (context.state.me.room.name) {
              console.log('sync(JOIN,' + context.state.me.room.name + '):', remoteId);
            } else {
              console.log('sync(LEAVE):', remoteId);
            }
          }
        } else {
          // コネクションが閉じていれば削除する
          if (context.state.develop_mode) console.log('sync(MISSING):', remoteId);
          context.commit('_delPeer', remoteId);
          context.commit('_delConnection', remoteId);
          if (context.state.develop_mode) console.log('既存ピア ' + remoteId + ' を削除しました');
        }
      });
    },

    // ログアウト操作
    async logout(context) {
      // SkyWay終了
      context.commit('_killPeer');
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
    },
  },

  modules: {
  }
})
