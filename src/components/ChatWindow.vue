<template>
  <!-- チャットダイアログ -->
  <v-dialog v-model="toggle" max-width="640" scrollable :fullscreen="$vuetify.breakpoint.smAndDown">
    <v-card style="background-color:rgba(255,255,255,0.8); overflow:hidden;">

      <v-card-title class="pt-3">
        チャット
        <v-spacer></v-spacer>
        <v-btn fab depressed dark small color="black" @click="toggle=false"><v-icon>mdi-close</v-icon></v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text ref="message_area" style="height:90vh;" class="px-2">
        <v-list subheader style="background-color:transparent;" class="pt-2 mb-10">

          <!-- 基本CSSはmessageクラス・自分のみmessage-meクラス追加 -->
          <v-list-item v-for="(payload, index) in chat_payloads" :key="index" class="px-0 message" :class="{ 'message-me': (payload.id == me.id && payload.type == 'user') }">
            <v-avatar v-if="payload.type == 'system'" color="red" size="36" class="mx-1"><v-icon dark>mdi-robot</v-icon></v-avatar>
            <v-avatar v-else-if="!payload.icon" color="indigo" size="36" class="mx-1"><v-icon dark>mdi-account-circle</v-icon></v-avatar>
            <v-avatar v-else size="36" class="mx-1"><img :src="payload.icon"></v-avatar>
            <v-list-item-content class="my-n2">
              <v-list-item-subtitle class="name">{{ (payload.type == 'user') ? payload.name : 'V-Bot' }}</v-list-item-subtitle>

              <!-- メッセージ本文 -->
              <v-list-item-title class="frame">
                <div v-if="payload.type == 'user'" class="body text-wrap pa-2 green accent-1">{{ payload.body }}</div>
                <div v-else class="body text-wrap pa-2 cyan lighten-3" >{{ payload.body }}</div>
              </v-list-item-title>

            </v-list-item-content>
          </v-list-item>

        </v-list>
      </v-card-text>

      <v-divider></v-divider>

      <!-- 送信フォーム -->
      <v-row class="pa-2 message_input_area" dense>
        <v-col cols="10" sm="11">
          <v-text-field autofocus dense outlined solo flat single-line v-model="my_message" label="Enterで送信" @keydown.enter="sendMessage"></v-text-field>
        </v-col>
        <v-col cols="2" sm="1">
          <v-btn fab depressed small color="green accent-3" @click="sendMessage"><v-icon>mdi-send</v-icon></v-btn>
        </v-col>
      </v-row>

    </v-card>
  </v-dialog>
</template>


<script>
export default {
  name: 'ChatWindow',

  props: {
    show: {
      type: Boolean,
      required: true,
      default: false,
    },
    me: {
      type: Object,
      required: true,
    },
    chat_payloads: {
      type: Array,
      required: true,
    },
  },

  data() {
    return {
      my_message: '',
    }
  },

  computed: {
    toggle: {
      get() { return this.$props.show },
      set(v) { this.$emit('toggle', v) }
    },
  },

  methods: {
    // メッセージ送信（ダイアログ内のボタンなどから発火）
    sendMessage: function(e) {
      // エンター送信時の日本語変換Enterの229は無視（通常は13）
      if (e instanceof KeyboardEvent && e.keyCode == 229) return;
      // 空文字は無視 / WIP 空白のみなどを正規表現でここで排除する
      if (!this.my_message) return;
      // チャット送信処理（親要素へ送信）
      this.$emit('send', this.my_message);
      this.my_message = '';
    },
  },

  watch: {
    chat_payloads(state) {
      // チャット配列が変化したらメッセージエリアを最下部までスクロールさせる
      if (this.$refs.message_area) {
        // 最初はDOMが生成されておらずmessage_areaがundefinedになる
        const scroll_size = this.$refs.message_area.scrollHeight;
        this.$refs.message_area.scrollTo(0, scroll_size);
      }
    },
  },
}
</script>


<style lang="scss">
// メッセージ全体
.message {
  align-items: end; // アイコンと吹き出しの高さをあわせる
}
.message .frame { overflow:visible; width:100%; }
.message .frame div.body {
  display: inline-block;
  max-width: 85%; // 吹き出しの幅
  text-align: left; // アラビア語などではrightにする（多言語対応後）
  box-shadow: 2px 2px 2px rgba(0, 0, 0, 0.5);
  border-radius: 0 20px 20px 20px;
}
// 以下は自分発のみ
.message-me { flex-flow: row-reverse; text-align: end; }
.message-me .frame div.body {
  box-shadow: -2px 2px 2px rgba(0, 0, 0, 0.5);
  border-radius: 20px 0 20px 20px;
}
// オーバーライド（テキスト入力部の詳細を表示しないことで高さを削除）
.message_input_area div.v-text-field__details {
  display: none !important;
}
</style>