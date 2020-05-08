<template>
  <v-list subheader shaped>
    <v-subheader>オンライン ユーザー</v-subheader>
    <v-list-item v-for="(peer, peer_id, index) in peers" :key="index">
      <v-list-item-avatar color="indigo">
        <v-icon v-if="!peer.icon_url" dark>mdi-account-circle</v-icon>
        <v-img v-else :src="peer.icon_url"></v-img>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title v-text="peer.display_name + ((peer.joined_room_name != '') ? ' @ '+peer.joined_room_name : '')"></v-list-item-title>
        <v-list-item-subtitle>Peer ID: {{ peer_id }}</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script>
export default {
  name: 'UserList',
  props: {
    peers: {
      type: Object,
      required: true,
    },
  },
}
</script>