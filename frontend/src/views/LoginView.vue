<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card rounded="xl" elevation="1" class="pa-6">
          <div class="text-h5 font-weight-bold mb-2">Admin Login</div>

          <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
            {{ error }}
          </v-alert>

          <v-text-field
            v-model="username"
            label="Username"
            variant="outlined"
            autocomplete="username"
            class="mb-2"
          />
          <v-text-field
            v-model="password"
            label="Password"
            variant="outlined"
            type="password"
            autocomplete="current-password"
            class="mb-4"
            @keyup.enter="doLogin"
          />

          <v-btn color="primary" variant="flat" block :loading="loading" @click="doLogin">
            Log in
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../services/api";

const emit = defineEmits(["auth-changed"]);
const router = useRouter();

const username = ref("admin");
const password = ref("");
const loading = ref(false);
const error = ref("");

async function doLogin() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value, password.value);
    emit("auth-changed");
    router.push("/announcements");
  } catch {
    error.value = "Login failed. Check username/password.";
  } finally {
    loading.value = false;
  }
}
</script>

