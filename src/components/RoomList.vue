<template>
  <v-list subheader>
    <v-subheader>ルームリスト</v-subheader>

    <v-list-item v-for="(room_info, room_name, room_index) in rooms" :key="room_index">
      <v-list-item-icon class="pt-0"><v-icon>mdi-chat-processing</v-icon></v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>{{ room_name }}</v-list-item-title>
        <v-list-item-subtitle>
          <v-chip class="mx-1" x-small v-for="(peer_id, index) in room_info.members" :key="index">{{ peers[peer_id].name }}</v-chip>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-content>
        <v-btn outlined small color="secondary" disabled>{{ room_info.type }}</v-btn>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn rounded color="primary"
          @click="$store.dispatch('setMyRoom', {name: room_name, type: room_info.type})"
        ><v-icon>mdi-account-arrow-right</v-icon>入室</v-btn>
      </v-list-item-action>
    </v-list-item>

    <v-divider></v-divider>

    <v-list-item>
      <v-list-item-icon class="pt-4"><v-icon>mdi-chat-plus</v-icon></v-list-item-icon>
      <v-list-item-content>
        <v-form ref="form" v-model="new_room.valid" @submit.prevent>
          <v-text-field class="" v-model="new_room.name" :rules="room_name_rules" label="新規ルーム名を入力…" counter maxlength="20"></v-text-field>
        </v-form>
      </v-list-item-content>
      <v-list-item-action>
        <v-tooltip v-if="new_room.is_mesh" bottom>
          <template v-slot:activator="{ on }">
            <v-btn outlined small color="green darken-2" @click="new_room.is_mesh = false" v-on="on">MESH</v-btn>
          </template>
          <span>すべてのピアと直接暗号化通信します。<br>ネットワーク負荷が高いため、同時入室は4人程度までにしてください。</span>
        </v-tooltip>
        <v-tooltip v-else bottom>
          <template v-slot:activator="{ on }">
            <v-btn outlined small color="deep-orange accent-3" @click="new_room.is_mesh = true" v-on="on">SFU</v-btn>
          </template>
          <span>SFUサーバーを経由するため途中で暗号化が解除されますが、多人数での利用が可能です。</span>
        </v-tooltip>
        <v-btn rounded small color="red"
          @click="$store.dispatch('setMyRoom', {name: new_room.name, type: ((new_room.is_mesh) ? 'mesh' : 'sfu')})"
          :disabled="!new_room.valid"
        >作成&入室</v-btn>
      </v-list-item-action>
    </v-list-item>

  </v-list>
</template>

<script>
export default {
  name: 'RoomList',
  props: {
    rooms: {
      type: Object,
      required: true,
    },
    peers: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      // 新規追加するルーム
      new_room: {
        name: '',
        is_mesh: true,
        valid: false,
      },
      room_name_rules: [
        v => !!v || 'ルーム名を入力してください',
        v => v.length >= 3 || '3文字以上にしてください',
        v => /^[0-9a-zA-Z]+$/.test(v) || '半角英数字のみで入力してください',
        v => v.toLowerCase() != 'main' || '"Main"は利用できません',
        v => !(v in this.rooms) || '同名のルームがすでに存在します',
      ],
    }
  },
}
</script>