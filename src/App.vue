<template>
  <v-app>

    <v-app-bar app color="primary" dark>
      <div class="d-flex align-center">
        <!-- <router-link :to="{ name: 'Dashboard' }"><h1>v-sky</h1></router-link> -->
        <h1>{{ title }}</h1>
      </div>
      <v-spacer></v-spacer>
    </v-app-bar>

    <v-content>
      <router-view />
    </v-content>

  </v-app>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      title: process.env.VUE_APP_TITLE,
    }
  },
};
</script>

<style lang="scss">
h1 {
  font-family: 'Varela Round', cursive;
}
</style>
