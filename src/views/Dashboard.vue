<template>
  <v-container>

    <v-row justify="center">

      <v-col v-if="!in_room" cols="12" sm="8">
        <RoomList :rooms="rooms" :peers="peers" />
      </v-col>

      <v-col v-else cols="12" sm="8">
        <RoomView :mydata="mydata" :rooms="rooms" :streams="remote_streams" :peers="peers" />
      </v-col>


      <v-col cols="12" sm="4">

        <MyCard :mydata="mydata" /> <!-- Vuex使っているので状態管理に注意 -->

        <UserList :peers="peers" />

      </v-col>

    </v-row>

  </v-container>
</template>



<script>
import RoomList from '@/components/RoomList.vue'
import RoomView from '@/components/RoomView.vue'
import MyCard   from '@/components/MyCard.vue'
import UserList from '@/components/UserList.vue'

export default {
  components: {
    RoomList,
    RoomView,
    MyCard,
    UserList,
  },

  data() {
    return {
      develop_mode: (process.env.NODE_ENV == 'local' || process.env.NODE_ENV == 'development'),
      // メディア
      skyway_apikey: process.env.VUE_APP_SKYWAY_APIKEY,
      my_id: '',
      remote_streams: {},
      // ユーザー状態
      in_room: false,
      // 自分の基本データ（P2P送信にも利用する）
      mydata: {
        display_name: '',
        icon_url: '',
        joined_room_name: '',
        joined_room_type: '',
      },
      // ピア状態
      peers: {},
      data_connections: {},
    }
  },

  created() {
    // ログインチェック
    // ルーターでliff.init()実行済
    if ('guest' in this.$route.query && this.$route.query.guest != '') {
      // guestパラメータが設定されていればその名前でゲストログイン
      this.$store.commit('login', [this.$route.query.guest, '', 'ゲスト - オフライン']);
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
  },

  mounted: async function() {
    // SkyWay接続
    this.$store.state.skyway.peer = new Peer({
      key: this.skyway_apikey,
      debug: ((this.develop_mode)? 3 : 1),
    });

    // エラーハンドラ
    this.$store.state.skyway.peer.on('error', error => {
      this.dumpLog(`Peer接続に関するエラーが発生しました: ${error.type}: ${error.message}`);
    });

    // シグナリングサーバ接続
    // 定期的に発火するっぽい？
    this.$store.state.skyway.peer.on('open', id => {
      this.my_id = id;
      this.$store.commit('setUserStatus', 'オンライン - ' + this.my_id);
      // 接続通知を送信
      this.sayHello();
    });

    // シグナリングサーバ切断
    this.$store.state.skyway.peer.on('disconnected', () => {
      this.$store.commit('setUserStatus', 'オフライン');
    });

    // データコネクション到着
    this.$store.state.skyway.peer.on('connection', incomingDataConnection => {
      const peer_id = incomingDataConnection.remoteId;
      // 特定のピアからデータが来たとき
      incomingDataConnection.on('data', ({display_name, icon_url, joined_room_name, joined_room_type}) => {
        // すでに登録されている（データコネクション確立している）ピアかどうか
        if (peer_id in this.peers) {
          this.dumpLog(display_name+'から更新を受信しました');
          // データコネクション以外は更新する
          this.upsertPeers(peer_id, display_name, icon_url, joined_room_name, joined_room_type, null);
        } else {
          // 未登録のピア（新規ユーザー）には応答する
          const outgoingDataConnection = this.$store.state.skyway.peer.connect(peer_id, {serialization: 'json'});
          outgoingDataConnection.on('open', () => outgoingDataConnection.send(this.mydata));
          this.dumpLog(display_name+'がオンラインになりました');
          // 相手ピアIDをキー名としてピア情報を追加する
          this.upsertPeers(peer_id, display_name, icon_url, joined_room_name, joined_room_type, outgoingDataConnection);
        }
      });
      // 特定のピアとのデータコネクションが切断されたとき
      incomingDataConnection.on('close', () =>{
        // オブジェクトから削除する
        this.dumpLog(this.peers[peer_id].display_name+'がオフラインになりました');
        this.removePeers(peer_id);
      });
    });
  },

  methods: {
    // DataConnectionを使ってすべてのピアに通知を送る
    // 接続直後のブロードキャストのみlistAllPeersを使って送信する
    // 上記を受信したピアはデータコネクションを保存しておき以後はそれに対して通信する
    sayHello: function() {
      // ピアごとにコネクションを作って送信
      this.$store.state.skyway.peer.listAllPeers(peers => {
        peers.forEach(peer_id => {
          if (peer_id == this.my_id) return; // 自分のIDはスキップ
          // WIP:以下でconnectするときすでにいないピアに接続しようとしてエラーが出る問題のハンドリング
          const outgoingDataConnection = this.$store.state.skyway.peer.connect(peer_id, {
            //dcInit: {maxRetransmits: 2},
            serialization: 'json',
          });
          outgoingDataConnection.on('open', () => {
            // 確立したら送信
            outgoingDataConnection.send(this.mydata);
            // 相手の情報を登録しておく
            // ここで確定しているのはOutgoingのデータコネクションのみ
            this.upsertPeers(peer_id, '', '', '', '', outgoingDataConnection);
          });
        });
      });
    },
    broadcast: function() {
      // 通常の状態通知通信は保存されたデータコネクションから送る
      let cnt = 0;
      Object.keys(this.data_connections).forEach(peer_id => {
        if (this.data_connections[peer_id].open) {
          // コネクションが開いたままのピアのみに送信する
          this.data_connections[peer_id].send(this.mydata);
          cnt++;
        }
      });
      this.dumpLog(cnt+'件のピアに状態変更を送信しました');
    },

    // 相手ピアに関するデータの操作
    upsertPeers: function(peer_id, name = '', icon = '', joined = '', room_type = 'mesh', connection = null) {
      this.$set(this.peers, peer_id, {
        display_name: name,          // ユーザー名（表示名）
        icon_url: icon,              // アイコンURL
        joined_room_name: joined,    // 現在入っているルーム名
        joined_room_type: room_type, // 現在入っているルームのタイプ（meshまたはsfu）
      });
      // コネクションが指定されていれば追加する（insertでありupdateではない）
      if (connection) this.$set(this.data_connections, peer_id, connection);
    },
    removePeers: function(peer_id) {
      if (peer_id in this.peers) this.$delete(this.peers, peer_id);
      if (peer_id in this.data_connections) { this.data_connections[peer_id].close(); this.$delete(this.data_connections, peer_id); }
    },

    // SkyWay:ルームに参加する
    joinRoom: function(room_name, room_type) {
      this.$store.state.skyway.room = this.$store.state.skyway.peer.joinRoom(room_name, {
        mode: room_type,
        stream: this.$store.state.local_media_stream,
      });
      // ルーム入室
      this.$store.state.skyway.room.on('open', () => {
        this.mydata.joined_room_name = room_name;
        this.mydata.joined_room_type = room_type;
        // 画面切替
        this.in_room = true;
        this.dumpLog('ルーム"'+room_name+'"（'+room_type+'）に入室しました @ Peer.joinRoom.on(\'open\')');
        // 変更をブロードキャストによって通知
        this.broadcast();
      });
      // 誰かからのストリームを受信したらデータ内の配列に追加する
      this.$store.state.skyway.room.on('stream', mediaStream => {
        this.$set(this.remote_streams, mediaStream.peerId, mediaStream);
      });
      // 誰かが退室したらデータからも削除
      this.$store.state.skyway.room.on('peerLeave', peerId => {
        this.$delete(this.remote_streams, peerId);
      });
    },

    // SkyWay:ルームから退室する
    leaveRoom: async function() {
      if (this.$store.state.skyway.room != '') {
        /*
        this.skyway_room.close(); // WIP:これちゃんと発火してるかわからんので要確認
        // 上は仮に機能していたとしても以下のon.closeはどうしても発生しない・要問合せ
        this.skyway_room.on('close', () => {
          this.skyway_room = '';
          Object.keys(this.remote_streams).forEach(peer_id => this.$delete(this.remote_streams, peer_id));
          this.dumpLog('ルームから退室しました');
        });
        */
        await this.$store.state.skyway.room.close();
        this.$store.state.skyway.room = '';
        Object.keys(this.remote_streams).forEach(peer_id => this.$delete(this.remote_streams, peer_id));
        this.mydata.joined_room_name = '';
        this.mydata.joined_room_type = '';
        this.dumpLog('ルーム"'+this.$store.state.skyway.room.name+'"から退室しました @ after Room.close()');
      } else {
        this.dumpLog('いずれのルームにも入室していないため退室できません');
      }
      // 画面切替
      this.in_room = false;
      // 変更をブロードキャストによって通知
      this.broadcast();
    },

    // 開発時のみログ出力
    dumpLog: function(message) {
      if (this.develop_mode) console.log('[DUMPLOG]', message);
    },

    // ポップアップを表示
    showSnackbar(text) {
      this.snackbarFlag = true;
      this.snackbarText = text;
      setTimeout(()=> {
          this.snackbarFlag = false
          this.snackbarText = ''
        }, this.snackbarTimeout);
    },
  },

  computed: {
    // 以下のcomputedはVuexの変数を監視
    // ログイン状態保持
    loginStatus() { return this.$store.state.login_status },
    username() { return this.$store.state.user_info.name },
    icon_url() { return this.$store.state.user_info.icon_url },
    joined_room() { return this.$store.state.user_info.room }, // Vuexにあるルーム名は末尾注意
    rooms() {
      // 自分も含めたピアの一覧を作る
      let allPeers = Object.assign({}, this.peers);
      allPeers[this.my_id] = {
        joined_room_name: this.mydata.joined_room_name,
        joined_room_type: this.mydata.joined_room_type,
      };
      // 返却値のベース：Mainは空室でも存在させる
      let room_list = {
        Main: {
          type: 'mesh',
          members: [],
        },
      };
      // ピアごとにルーム名を抽出する
      Object.keys(allPeers).forEach(peer_id => {
        const name = allPeers[peer_id].joined_room_name;
        const type = allPeers[peer_id].joined_room_type;
        // ルーム名ごとに処理
        if (name == '') {
          // ルーム名が空白ならどこにも入室していないのでスキップ
          return;
        } else if (name in room_list) {
          // ルーム名のキーがすでにある
          room_list[name].members.push(peer_id);
        } else {
          // ルーム名のキーがまだない
          room_list[name] = {
            type: type,
            members: [ peer_id ],
          };
        }
      });
      return room_list;
    },
  },

  watch: {
    // ログアウト状態になったときのみログインページへ飛ばす
    loginStatus(newValue, oldValue) { if (!newValue) this.$router.push({ name: 'Login' }) },
    //
    username(newName) { this.mydata.display_name = newName },
    icon_url(newUrl) { this.mydata.icon_url = newUrl },
    joined_room(newRoomName, oldRoomName) {
      if (newRoomName == '') {
        // 空文字列の場合は退室
        this.dumpLog(oldRoomName+'から退室しています… @ Vue$watch');
        this.leaveRoom();
      } else {
        // それ以外は入室
        // Vuexから受け取るルーム名の末尾2文字でMESH/SFUの判定をする（暫定対応）
        let roomObj;
        if (newRoomName.endsWith('_S')) {
          // SFUルーム
          roomObj = {name: newRoomName.slice(0, -2), type: 'sfu'};
        } else if (newRoomName.endsWith('_M')) {
          // MESHルーム
          roomObj = {name: newRoomName.slice(0, -2), type: 'mesh'};
        } else {
          // あり得ないが末尾に何もなかった場合はデフォルトでMESHとして扱う
          roomObj = {name: newRoomName, type: 'mesh'};
        }
        // 入室
        this.dumpLog(roomObj.name+'に入室しています… @ Vue$watch');
        this.joinRoom(roomObj.name, roomObj.type);
      }
    },
  },
}
</script>



<style lang="scss">
.video-stream {
  background-color: #A0A0A0;
  width: 100%;
}
</style>