<template>
  <v-card flat class="py-2">

    <v-subheader>ダイレクトコール</v-subheader>

    <v-list-item class="px-2">
      <v-list-item-icon class="mr-2 mt-1"><v-icon>mdi-phone-plus</v-icon></v-list-item-icon>
      <v-list-item-content class="py-0">
        <v-form v-model="client.valid" @submit.prevent>
          <v-text-field class="mt-0 pt-0"
            v-model="client.peer_id"
            :rules="client.rules"
            label="ピアIDを入力…"
            counter maxlength="16"
          ></v-text-field>
        </v-form>
      </v-list-item-content>
    </v-list-item>

    <v-row class="mx-10 caption brown--text lighten-1">1-on-1接続・E2EEでメディアとデータを送受信します。</v-row>

    <v-card-actions class="py-0" style="justify-content:flex-end;">
      <v-btn rounded color="lime"
        @click="$router.push({ path: '/direct/' + client.peer_id })"
        :disabled="!client.valid"
      ><v-icon>mdi-phone-forward</v-icon>接続</v-btn>
    </v-card-actions>

  </v-card>
</template>

<script>
export default {
  name: 'DirectCall',

  data() {
    return {
      client: {
        peer_id: '',
        valid: false,
        rules: [
          v => !!v || 'ピアIDを入力してください',
          v => /^[0-9a-zA-Z]+$/.test(v) || '半角英数字のみ有効です',
          v => v.length == 16 || '16文字必要です',
          v => v != this.$store.state.skyway.peer.id || '自身のIDには接続できません',
        ],
      },
    }
  },
}
</script>