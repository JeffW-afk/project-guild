<template>
  <v-app>
    <!-- TOP BAR -->
    <v-app-bar elevation="1">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>Project Guild</v-app-bar-title>

      <v-spacer />

      <v-chip v-if="user" size="small" variant="tonal" class="mr-3">
        {{ user.username }} • {{ user.guild_rank }}
      </v-chip>

      <v-btn v-if="!user" variant="text" to="/login">Login</v-btn>
      <v-btn v-else variant="text" @click="doLogout">Logout</v-btn>
    </v-app-bar>

    <!-- SIDE NAV -->
    <v-navigation-drawer v-model="drawer" elevation="1">
      <v-list nav density="comfortable">
        <!-- Everyone can view announcements -->
        <v-list-item
          title="Announcements"
          prepend-icon="mdi-bullhorn"
          to="/announcements"
        />

        <!-- Locked until login -->
        <v-list-item
          title="Members"
          prepend-icon="mdi-account-group"
          to="/members"
          :disabled="!user"
        />
        <v-list-item
          title="My Party"
          prepend-icon="mdi-account-star"
          to="/my-party"
          :disabled="!user"
        />
        <v-list-item
          title="Parties"
          prepend-icon="mdi-sword-cross"
          to="/parties"
          :disabled="!user"
        />
        <v-list-item
          v-if="user && ['admin','guild_master','founder'].includes(user.guild_rank)"
          title="Party Requests"
          prepend-icon="mdi-shield-account"
          to="/admin/party-requests"
        />
      </v-list>

      <v-divider class="my-2" />

      <v-list density="comfortable">
        <!-- If logged OUT: show Login -->
        <v-list-item
          v-if="!user"
          title="Login"
          prepend-icon="mdi-login"
          to="/login"
        />

        <!-- If logged IN: show Profile + Logout -->
        <v-list-item
          v-else
          title="Profile"
          prepend-icon="mdi-account-circle"
          to="/profile"
        />

        <v-list-item
          v-if="user"
          title="Logout"
          prepend-icon="mdi-logout"
          @click="doLogout"
        />
      </v-list>
    </v-navigation-drawer>


    <!-- PAGE CONTENT -->
    <v-main>
      <router-view :user="user" @auth-changed="refreshAuth" />
    </v-main>
  </v-app>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { authMe, logout } from "./services/api";

const router = useRouter();

const drawer = ref(true);
const user = ref(null);

async function refreshAuth() {
  try {
    const res = await authMe(); // { user: ... or null }
    user.value = res.user;
  } catch {
    user.value = null;
  }
}

async function doLogout() {
  await logout();
  await refreshAuth();
  router.push("/login");
}

onMounted(refreshAuth);
</script>
