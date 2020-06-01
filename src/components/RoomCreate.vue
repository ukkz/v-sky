<template>
  <v-card flat class="py-2">

    <v-subheader>新規作成 / 限定ルーム入室</v-subheader>

    <v-list-item class="px-2">
      <v-list-item-icon class="mr-2 mt-1"><v-icon>mdi-chat-plus</v-icon></v-list-item-icon>
      <v-list-item-content class="py-0">
        <v-form ref="form" v-model="newroom.valid" @submit.prevent>
          <v-text-field class="mt-0 pt-0"
            v-model="newroom.name"
            :rules="newroom.rules"
            :disabled="!newroom.public"
            label="ルーム名を入力…"
            counter maxlength="20"
          ></v-text-field>
        </v-form>
      </v-list-item-content>
    </v-list-item>

    <v-row class="mx-7">

      <v-col class="py-1" cols="auto">
        通信モード:
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn v-if="newroom.is_mesh" depressed small class="mx-1" color="green darken-2"  dark v-on="on">MESH</v-btn>
            <v-btn v-else                  outlined small class="mx-1" color="green lighten-4" @click="newroom.is_mesh = true" v-on="on">MESH</v-btn>
          </template>
          <span>すべての参加者と直接暗号化通信します。<br>ネットワーク負荷が高いため、同時入室は4人程度までにしてください。</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn v-if="!newroom.is_mesh" depressed small class="mx-1" color="deep-orange accent-3"  dark v-on="on">SFU</v-btn>
            <v-btn v-else                   outlined small class="mx-1" color="deep-orange lighten-4" @click="newroom.is_mesh = false" v-on="on">SFU</v-btn>
          </template>
          <span>SFUサーバーを経由するため途中で暗号化が解除されますが、多人数での利用が可能です。</span>
        </v-tooltip>
      </v-col>

      <v-col class="py-1" cols="auto">
        公開状態:
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn v-if="newroom.public" depressed small class="mx-1" color="amber darken-2"  dark v-on="on">公開</v-btn>
            <v-btn v-else                 outlined small class="mx-1" color="amber lighten-4" @click="newroom.public = true" v-on="on">公開</v-btn>
          </template>
          <span>このページの公開ルームリストに表示され、誰でも入室可能です。</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn v-if="!newroom.public" depressed small class="mx-1" color="teal" dark v-on="on">限定</v-btn>
            <v-btn v-else                  outlined small class="mx-1" color="teal lighten-4" @click="newroom.public = false" v-on="on">限定</v-btn>
          </template>
          <span>ルームURLまたはルーム名を知っている人のみ入室できます。<br>ルーム名は自動生成されるため指定できません。</span>
        </v-tooltip>
      </v-col>

    </v-row>

    <v-row class="mx-10 caption brown--text lighten-1">ルームが既存の場合、通信モードと公開状態は反映されません。</v-row>

    <v-card-actions class="py-0" style="justify-content:flex-end;">
      <v-btn rounded color="cyan"
        @click="$store.dispatch('setMyRoom', {name: newroom.name, type: ((newroom.is_mesh) ? 'mesh' : 'sfu'), public: newroom.public})"
        :disabled="!newroom.valid"
      ><v-icon>mdi-plus</v-icon>作成/入室</v-btn>
    </v-card-actions>

  </v-card>
</template>

<script>
export default {
  name: 'RoomCreate',
  props: {
    public_rooms: {
      type: Object,
      required: true,
    },
    my_peer_id: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      // 新規追加するルーム
      newroom: {
        name: '',
        public_name: '',
        private_name: '',
        is_mesh: true,
        public: true,
        valid: false,
        rules: [
          v => !!v || 'ルーム名を入力してください',
          v => v.length >= 3 || '3文字以上にしてください',
          v => /^[0-9a-zA-Z]+$/.test(v) || '半角英数字のみで入力してください',
          v => v.toLowerCase() != 'main' || '"Main"は利用できません',
          v => !(v in this.public_rooms) || '同名のルームがすでに存在します',
        ],
      },
    }
  },

  watch: {
    // ルームの公開状態がボタンによって切り替えられたとき
    'newroom.public': async function(val) {
      if (val) {
        // 公開ルームにする: 限定ルーム名を退避・入力欄に公開ルーム名を表示
        this.newroom.private_name = this.newroom.name;
        this.newroom.name = this.newroom.public_name;
      } else {
        // 限定ルームにする: 公開ルーム名を退避・入力欄に限定ルーム名を生成して表示
        this.newroom.public_name = this.newroom.name;
        this.newroom.name = await this.genRoomName();
      }
    },
  },

  methods: {
    async genRoomName(min_length = 7) {
      // 紛らわしい文字は抜いてある
      const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
      let roomname = '';
      do {
        // ピアIDとタイムスタンプ
        const seed = this.my_peer_id + Date.now();
        // string -> Uint8Array
        const msgUint8 = new TextEncoder().encode(seed);
        // SHA-256ダイジェスト
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        // buffer -> byte array
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        // byte array -> char selected string
        roomname = hashArray.map(b => (chars.length <= b) ? '' : chars.charAt(b)).join('');
      } while (roomname.length < min_length);
      return roomname;
    },
  },
}
</script>