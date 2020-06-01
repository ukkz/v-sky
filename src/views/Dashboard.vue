<template>
  <v-container style="height:100%;">

    <!-- サブ部：入室時はshrinkして簡易表示（高さ縮小） -->
    <v-row ref="sub" justify="center" class="my-n5">
      <MyInfo
        :me="me"
        :shrink="(current_room.name) ? true : false"
        @changeStream="setLocalMediaStream($event)"
      />
    </v-row>

    <!-- メイン部：高さ自動調整（ルーム内自動レイアウト用） -->
    <v-row ref="main" justify="center" v-bind:style="style_main">

      <!-- ルームに入っていないとき：リスト表示 -->
      <v-col v-if="!current_room.name" cols="12" :sm="(show_peerlist) ? 8 : 12">
        <RoomList   :public_rooms="public_rooms" :public_peers="skyway.public_peers" />
        <v-divider></v-divider>
        <RoomCreate :public_rooms="public_rooms" :my_peer_id="me.id" />
      </v-col>

      <!-- ルームに入っているとき：ルーム表示 -->
      <v-col v-if="current_room.name" cols="12">
        <RoomView
          :me="me"
          :mystream="local_media_stream"
          :skywaypeer="skyway.peer"
          @sync="sync"
          @changeRoom="changeRoom()"
        />
      </v-col>

      <!-- ピア一覧を表示 -->
      <v-col v-if="show_peerlist" cols="12" sm="4">
        <UserList :peers="skyway.public_peers" />
      </v-col>

    </v-row>

  </v-container>
</template>



<script>
import RoomCreate from '@/components/RoomCreate.vue'
import RoomList   from '@/components/RoomList.vue'
import RoomView   from '@/components/RoomView.vue'
import MyInfo     from '@/components/MyInfo.vue'
import UserList   from '@/components/UserList.vue'

export default {
  components: {
    RoomCreate,
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
        connections: {},  // 直接変更禁止
        public_peers: {}, // 直接変更禁止
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
      debug: ((this.develop_mode) ? 2 : 0),
    });

    // シグナリングサーバ接続
    // 自身のIDを記録し接続通知を送信
    this.skyway.peer.on('open', myid => {
      // 自分のピアIDをセットしオンライン状態に
      this.$store.dispatch('setMyPeerId', myid);
      // Peer全てに通知
      this.syncAllPeers();
    });

    // シグナリングサーバ切断
    this.skyway.peer.on('disconnected', () => this.$store.dispatch('clearMyPeerId'));

    // データコネクション到着
    this.skyway.peer.on('connection', incomingDC => {
      // 誰かからデータが来たとき
      incomingDC.on('data', anybody => this.setOtherPeer(incomingDC.remoteId, anybody));
      // 誰かとのデータコネクションが切断されたとき
      incomingDC.once('close', () => this.removeOtherPeer(incomingDC.remoteId));
    });
  },

  // ログアウトするとログインページに戻るのでdestroyされる > その前にskyway切断する
  beforeDestroy() { this.skyway.peer.destroy(); this.skyway.peer = null },

  // 状態変化に伴うrerender後に発火
  updated() {
    // this.$refs.main の高さを調整する
    const offset = parseInt(this.$refs.sub.offsetHeight) - 38;
    this.style_main.height = 'calc(100% - ' + offset + 'px)';
  },

  methods: {
    // シグナリングサーバ接続直後にlistAllPeersを使ってmeObjectを送信
    syncAllPeers() {
      // ピアごとにコネクションを作って送信
      this.skyway.peer.listAllPeers(peers => {
        peers.forEach(pid => {
          if (pid == this.skyway.peer.id) return; // 自分のIDはスキップ
          const outgoingDC = this.skyway.peer.connect(pid, { serialization: 'json' });
          // 接続されたら自身のmeObjectを送信
          outgoingDC.once('open', () => {
            outgoingDC.send(this.me);
            if (this.develop_mode) console.log('syncAllPeers:', pid);
          });
        });
      });
    },

    // ピアリストに登録済みのピアに自身の情報を送信
    sync() {
      // 保存されたデータコネクションから送る
      let cnt = 0;
      Object.keys(this.skyway.connections).forEach(remoteId => {
        const dc = this.skyway.connections[remoteId];
        if (dc.open) {
          // コネクションが開いたままのピアのみに送信する
          dc.send(this.me);
          if (this.develop_mode) {
            if (this.current_room.name) {
              console.log('sync(JOIN,'+this.current_room.name+'):', remoteId);
            } else {
              console.log('sync(LEAVE):', remoteId);
            }
          }
        } else {
          // コネクションが閉じていれば削除する
          if (this.develop_mode) console.log('sync(MISSING):', remoteId);
          this.removeOtherPeer(remoteId);
        }
      });
    },

    // ルームのタイプ変更またはストリーム更新による再入室
    // RoomViewからの通知を受けて実行される
    changeRoom() {
      // 書き換えられているルーム状態をコピーする
      const new_room_obj = Object.assign({}, this.$store.state.me.room);
      // 一度ルームをクリアする ... 退室してRoomViewをdestroyする
      this.$store.dispatch('clearMyRoom');
      // roomsプロパティに以前のルームの情報が残ってしまっているので消す
      this.skyway.peer.rooms = {};
      // データの反映とDOMの反映が行われたのちに再度ルーム変数をセットしてRoomViewをmountする
      this.$nextTick(() => this.$store.dispatch('setMyRoom', new_room_obj));
    },

    // 自分のメディアストリームの設定と削除
    setLocalMediaStream(stream) { this.$set(this, 'local_media_stream', stream) },

    // 自分以外のピア情報とデータ接続を追加または更新する
    setOtherPeer(target_id, meObject) {
      // ピア情報を追加または更新する
      this.$set(this.skyway.public_peers, target_id, meObject);
      if (!(target_id in this.skyway.connections)) {
        // 外向きのコネクションリストに存在しなければ作成・保存
        const outgoingDC = this.skyway.peer.connect(target_id, { serialization: 'json' });
        outgoingDC.once('close', () => { if (this.develop_mode) console.log('既存ピア '+target_id+' が切断されました') });
        outgoingDC.once('open', () => {
          if (this.develop_mode) console.log('新規ピア '+target_id+' ('+meObject.name+') と接続されました');
          if (this.current_room.public !== false) {
            // 未入室か公開ルームにいる場合（this.current_roomがtrueまたはnull）のみ返答する
            outgoingDC.send(this.me);
            if (this.develop_mode) console.log('次のデータを返送します:', this.me);
          } else {
            // 限定ルームにいる場合は返答しない
            if (this.develop_mode) console.log('ルーム公開状態 "'+String(this.current_room.public)+'" のため応答しませんでした');
          }
          // connectionsリストに追加する
          this.$set(this.skyway.connections, target_id, outgoingDC);
        });
      } else {
        // すでにコネクションが保存済みならデータ更新のみ
        if (this.develop_mode) console.log('既存ピア '+meObject.name+' が更新されました - ルーム状態:', meObject.room.name);
      }
    },
    removeOtherPeer(target_id) {
      if (target_id in this.skyway.connections && this.skyway.connections[target_id].open) this.skyway.connections[target_id].close();
      this.$delete(this.skyway.connections,  target_id);
      this.$delete(this.skyway.public_peers, target_id);
      if (this.develop_mode) console.log('既存ピア '+target_id+' を削除しました');
    },
  },

  computed: {
    // ログイン状態保持
    jump_when_logged_out() { return this.$store.state.logged_in },
    // ピア情報から公開ルームの配列を作成する
    public_rooms() {
      // 返却値のベース：Mainは空室でも存在させる
      let room_list = {
        Main: {
          type: 'mesh',
          members: [],
          public: true,
        },
      };
      // ピアごとにルーム名を抽出する
      Object.keys(this.skyway.public_peers).forEach(id => {
        const name = this.skyway.public_peers[id].room.name;
        const type = this.skyway.public_peers[id].room.type;
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
            public: true,
          };
        }
      });
      return room_list;
    },
    // 以下はVuex監視
    me() { return this.$store.state.me },
    current_room() { return this.me.room },
  },

  watch: {
    // ログアウト状態になったときのみログインページへ飛ばす
    jump_when_logged_out(newValue, oldValue) { if (!newValue) this.$router.push({ name: 'Login' }) },
  },
}
</script>