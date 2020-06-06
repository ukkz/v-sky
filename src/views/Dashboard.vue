<template>
  <v-container style="height:100%;">

    <!-- コアコンポーネント -->
    <v-row justify="center" class="my-n5">
      <MyInfo :shrink="false" />
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
      </v-col>
    </v-row>

  </v-container>
</template>



<script>
import RoomCreate from '@/components/RoomCreate.vue'
import RoomList   from '@/components/RoomList.vue'
import MyInfo     from '@/components/MyInfo.vue'

export default {
  components: {
    RoomCreate,
    RoomList,
    MyInfo,
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