<template>
  <v-list subheader>
    <v-subheader>公開ルームリスト</v-subheader>

    <v-list-item v-for="(room, name, i) in public_rooms" :key="i" class="px-2">
      <v-list-item-icon class="mr-2"><v-icon>mdi-chat-processing</v-icon></v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>
          {{ name }}
          <v-chip
            :color="(room.type == 'mesh') ? 'green darken-2' : 'deep-orange accent-3'"
            text-color="white" class="mx-1" x-small
          >{{ room.type.toUpperCase() }}</v-chip>
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip
            v-for="(pid, i) in room.members" :key="i"
            class="mx-1" x-small
          >{{ public_peers[pid].name }}</v-chip>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="ml-2">
        <v-btn rounded dark color="indigo accent-4"
          @click="$store.dispatch('setMyRoom', {name: name, type: room.type, public: true})"
        ><v-icon>mdi-account-arrow-right</v-icon>入室</v-btn>
      </v-list-item-action>
    </v-list-item>

  </v-list>
</template>

<script>
export default {
  name: 'RoomList',
  props: {
    public_rooms: {
      type: Object,
      required: true,
    },
    public_peers: {
      type: Object,
      required: true,
    },
  },
}
</script>