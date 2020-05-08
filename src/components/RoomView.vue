<template>
  <v-card class="mx-auto">
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="headline">{{ mydata.joined_room_name }} [{{ mydata.joined_room_type.toUpperCase() }}]</v-list-item-title>
        <v-list-item-subtitle>参加数: {{ rooms[mydata.joined_room_name].members.length }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn rounded color="warning" @click="$store.commit('clearJoinedRoom')">退室</v-btn>
      </v-list-item-action>
    </v-list-item>
  
    <v-item-group>
      <v-container>
        <v-row dense>
          <v-col v-for="(stream, peer_id, index) in streams" :key="index" :cols="col_width">
            <v-item>
              <v-card tile>
                <video class="video-stream" :srcObject.prop="stream" autoplay playsinline></video>
                <div style="position:absolute;top:16px;left:16px; color:white; text-shadow:1px 1px 3px black;">
                  <v-avatar color="indigo">
                    <v-icon v-if="!peers[peer_id].icon_url" dark>mdi-account-circle</v-icon>
                    <img v-else :src="peers[peer_id].icon_url">
                  </v-avatar>
                  <span class="px-2">{{ peers[peer_id].display_name }}</span>
                </div>
              </v-card>
            </v-item>
          </v-col>
        </v-row>
      </v-container>
    </v-item-group>
  </v-card>
</template>

<script>
export default {
  name: 'RoomView',
  props: {
    mydata: {
      type: Object,
      required: true,
    },
    rooms: {
      type: Object,
      required: true,
    },
    streams: {
      type: Object,
      required: true,
    },
    peers: {
      type: Object,
      required: true,
    },
  },

  computed: {
    col_width() {
      const l = Object.keys(this.streams).length;
      switch (l) {
        case 0:
        case 1:
          return 12;
        case 2:
          return 6;
        case 3:
          return 4;
        case 4:
          return 6;
        case 5:
        case 6:
          return 4;
        case 7:
        case 8:
          return 3;
        case 9:
          return 4;
        default:
          return 3;
      }
    },
  },
}
</script>