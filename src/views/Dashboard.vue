<template>
  <v-container style="height:100%;">

    <!-- コアコンポーネント -->
    <v-row justify="center" class="my-n5">
      <Core :shrink="false" />
    </v-row>

    <v-row justify="center">
      <v-col cols="12">

        <!-- 公開ルーム一覧 -->
        <RoomList
          :public_rooms="$store.getters.public_rooms"
          :public_peers="$store.state.skyway.public_peers"
          @join="join($event)"
        />

        <v-divider></v-divider>

        <!-- 新規ルーム作成 -->
        <RoomCreate
          :public_rooms="$store.getters.public_rooms"
          :my_peer_id="$store.state.me.id"
          @join="join($event)"
        />

        <v-divider></v-divider>

        <!-- ダイレクトコール -->
        <DirectCall />

        <!-- ダイレクトコール応答ダイアログ -->
        <DirectAnswer />
        
      </v-col>
    </v-row>

  </v-container>
</template>



<script>
import Core         from '@/components/Core.vue'
import DirectAnswer from '@/components/DirectAnswer.vue'
import DirectCall   from '@/components/DirectCall.vue'
import RoomCreate   from '@/components/RoomCreate.vue'
import RoomList     from '@/components/RoomList.vue'

export default {
  components: {
    Core,
    DirectAnswer,
    DirectCall,
    RoomCreate,
    RoomList,
  },

  mounted() {
    // 1stepモードではこのDashboardを表示させないのでアクセスがあった場合はログアウトさせる
    if (this.$store.state.config.onestep_mode) {
      // セッションストレージ変数削除
      sessionStorage.clear();
      // store/index.jsのactionsでLINEログアウト処理などを行ったのち状態変数をログアウトに
      this.$store.dispatch('logout');
      // ログインページ（1stepモード用パラメータ付き）
      this.$router.push({ path: '/login', query: { '1step': null } });
    }
  },

  methods: {
    // 部屋への参加
    // meObjectRoom = { name: 部屋名, type: meshかsfu, public: trueかfalse }
    join(meObjectRoom) {
      this.$store.commit('setMyRoom', meObjectRoom);
      this.$router.push({ path: '/room/'+meObjectRoom.name });
    },
  },
}
</script>