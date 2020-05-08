import Vue from 'vue';
import Vuetify from 'vuetify/lib';
import colors from 'vuetify/lib/util/colors'

Vue.use(Vuetify);

export default new Vuetify({
    theme: {
        themes: {
            imare: {
                primary: colors.indigo.darken-1,
                secondary: colors.grey.lighten-4,
                accent: colors.yellow.accent-2,
            },
        },
    },
});
