<template>
  <v-container style="height:100%;">

    <!-- サブ部：入室時はshrinkして簡易表示（高さ縮小） -->
    <v-row ref="sub" justify="center" class="my-n5">
      <MyInfo :me="me" v-on:changeStream="setLocalMediaStream($event)" :shrink="(current_room.name) ? true : false" />
    </v-row>

    <!-- メイン部：高さ自動調整（ルーム内自動レイアウト用） -->
    <v-row ref="main" justify="center" v-bind:style="style_main">

      <!-- ルームに入っていないとき：一覧表示 -->
      <v-col v-if="!current_room.name" cols="12" :sm="(show_peerlist) ? 8 : 12">
        <RoomList :rooms="rooms" :peers="peers" />
      </v-col>
      <!-- ルームに入っているとき：ルーム内表示 -->
      <v-col v-if="current_room.name" cols="12">
        <RoomView :me="me" :mystream="local_media_stream" :skywaypeer="skyway.peer" :peers="peers" v-on:roomChange="sync" />
      </v-col>

      <!-- ピア一覧を表示 -->
      <v-col v-if="show_peerlist" cols="12" sm="4">
        <UserList :peers="peers" />
      </v-col>

    </v-row>

  </v-container>
</template>



<script>
import RoomList from '@/components/RoomList.vue'
import RoomView from '@/components/RoomView.vue'
import MyInfo   from '@/components/MyInfo.vue'
import UserList from '@/components/UserList.vue'

export default {
  components: {
    RoomList,
    RoomView,
    MyInfo,
    UserList,
  },

  data() {
    return {
      develop_mode: (process.env.NODE_ENV == 'development'),
      // メディア
      local_media_stream: (new MediaStream()), // 直接変更禁止
      skyway: {
        apikey: process.env.VUE_APP_SKYWAY_APIKEY,
        peer: null,
        connections: {},
      },

      // その他設定
      show_peerlist: false,
      // スタイル
      style_main: {
        height: '100%',
      },
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

    // SkyWayのPeerを作成する（この時点ではStreamは不要）
    this.skyway.peer = new Peer({
      key: this.skyway.apikey,
      debug: ((this.develop_mode) ? 3 : 1),
    });

    // エラーハンドラ
    this.skyway.peer.on('error', error => {
      if (this.develop_mode) console.log(`Peer接続に関するエラーが発生しました: ${error.type}: ${error.message}`);
    });

    // シグナリングサーバ接続
    // 自身のIDを記録し接続通知を送信
    this.skyway.peer.on('open', myid => {
      // 自分のピアIDをセットしオンライン状態に（ピアリストにも登録）
      this.$store.dispatch('setMyPeerId', myid);
      // Peer全てに通知
      this.broadcast();
    });
    // シグナリングサーバ切断
    this.skyway.peer.on('disconnected', () => this.$store.dispatch('clearMyPeerId'));

    // データコネクション到着
    this.skyway.peer.on('connection', incomingDataConnection => {
      const remoteId = incomingDataConnection.remoteId;
      // 特定のピアからデータが来たとき
      incomingDataConnection.on('data', anybody => {
        if (anybody.id in this.peers && anybody.id in this.skyway.connections) {
          // すでに登録されている（データコネクション確立している）ピア
          if (this.develop_mode) console.log(anybody.name + 'から更新を受信しました :', anybody.room);
          // ピア情報を更新する
          this.$store.commit('updatePeer', anybody);
        } else {
          // 未登録のピア（新規ユーザー）には返答する
          if (!incomingDataConnection.open) return;
          // 誰かがログアウトしたりページを終了すると以下でRTCErrorEventが発生する
          const newConnection = this.skyway.peer.connect(remoteId, { serialization: 'json' });
          newConnection.on('open', () => newConnection.send(this.me));
          if (this.develop_mode) console.log(anybody.name + 'がオンラインになりました - 次のデータを返送します :', this.me);
          // ピア情報とDataConnectionを追加する
          this.$store.commit('updatePeer', anybody);
          this.$set(this.skyway.connections, newConnection.remoteId, newConnection);
        }
      });
      // 特定のピアとのデータコネクションが切断されたとき
      incomingDataConnection.on('close', () => {
        // オブジェクトから削除する
        if (this.develop_mode) console.log(remoteId + 'がオフラインになりました');
        // DataConnectionを明示的に切断する
        if (remoteId in this.skyway.connections && 
            this.skyway.connections[remoteId] && 
            this.skyway.connections[remoteId].open) 
            this.skyway.connections[remoteId].close(true);
        this.$delete(this.skyway.connections, remoteId);
        this.$store.commit('removePeer', remoteId);
      });
    });
  },

  // ログアウトするとログインページに戻るのでdestroyされる > その前にskyway切断する
  beforeDestroy() { this.skyway.peer.destroy(); this.skyway.peer = null },

  // 状態変化に伴うrerender後に発火
  updated() {
    // this.$refs.main の高さを調整する
    const offset = parseInt(this.$refs.sub.offsetHeight) - 48;
    this.style_main.height = 'calc(100% - ' + offset + 'px)';
  },

  methods: {
    // DataConnectionを使ってすべてのピアに通知を送る
    // 接続直後のブロードキャストのみlistAllPeersを使って送信する
    // 受信したピアはDataConnectionを保存しておき以後はそれに対して通信する
    broadcast() {
      // ピアごとにコネクションを作って送信
      let cnt = 0;
      this.skyway.peer.listAllPeers(peers => {
        peers.forEach(pid => {
          if (pid == this.skyway.peer.id) return; // 自分のIDはスキップ
          // WIP:以下でconnectするときすでにいないピアに接続しようとしてエラーが出る問題のハンドリング
          const outgoingDataConnection = this.skyway.peer.connect(pid, {
            //dcInit: {maxRetransmits: 2},
            serialization: 'json',
          });
          outgoingDataConnection.on('open', () => {
            // 確立したら送信
            outgoingDataConnection.send(this.me);
            // 相手の情報を登録しておく（確定しているのはピアIDとOutgoingのデータコネクションのみ）
            // meObjectはテンプレートなのでコピーして使う
            const anybody = this.$store.getters.emptyMeObject;
            anybody.id = pid;
            this.$store.commit('updatePeer', anybody);
            this.$set(this.skyway.connections, pid, outgoingDataConnection);
            cnt++;
          });
        });
      });
      if (this.develop_mode) console.log(cnt + '件のピアにbroadcast送信しました :', this.current_room);
    },

    // ピアリストに登録済みのピアに自身の情報を送信
    sync() {
      // 保存されたデータコネクションから送る
      let cnt = 0;
      Object.keys(this.skyway.connections).forEach(remoteId => {
        const dc = this.skyway.connections[remoteId];
        // コネクションが開いたままのピアのみに送信する
        if (dc && dc.open) { dc.send(this.me); cnt++; }
      });
      if (this.develop_mode) console.log(cnt + '件のピアにsync送信しました :', this.current_room);
    },

    // 自分のメディアストリームの設定と削除
    setLocalMediaStream(stream) { this.$set(this, 'local_media_stream', stream) },
  },

  computed: {
    // ログイン状態保持
    jump_when_logged_out() { return this.$store.state.logged_in },
    // ピア情報から公開ルームの配列を作成する
    rooms() {
      // 返却値のベース：Mainは空室でも存在させる
      let room_list = {
        Main: {
          type: 'mesh',
          members: [],
        },
      };
      // ピアごとにルーム名を抽出する
      Object.keys(this.$store.state.peers).forEach(id => {
        const name = this.$store.state.peers[id].room.name;
        const type = this.$store.state.peers[id].room.type;
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
            members: [ id ],
          };
        }
      });
      return room_list;
    },
    // 自分が入っているルームの人数
    person_count() {
      return (this.me.room && this.me.room in this.rooms) ? parseInt(this.rooms[this.me.room].members.length) : 0;
    },
    // 以下はVuex監視
    me() { return this.$store.state.me },
    peers() { return this.$store.state.peers },
    current_room() { return this.me.room },
  },

  watch: {
    // ログアウト状態になったときのみログインページへ飛ばす
    jump_when_logged_out(newValue, oldValue) { if (!newValue) this.$router.push({ name: 'Login' }) },
  },
}
</script>