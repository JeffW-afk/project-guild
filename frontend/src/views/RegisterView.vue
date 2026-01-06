<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card rounded="xl" elevation="1" class="pa-6">
          <div class="text-h5 font-weight-bold mb-2">Register</div>

          <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
            {{ error }}
          </v-alert>

          <v-text-field v-model="username" label="Username" variant="outlined" class="mb-2" />
          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            variant="outlined"
            class="mb-2"
          />

          <v-select
            v-model="requested"
            :items="roleOptions"
            item-title="label"
            item-value="value"
            label="Role (optional)"
            variant="outlined"
            class="mb-2"
          />

          <v-textarea
            v-if="requested === 'admin'"
            v-model="message"
            label="Message to admins (optional)"
            variant="outlined"
            rows="3"
            class="mb-3"
          />

          <v-btn color="primary" variant="flat" block :loading="loading" @click="doRegister">
            Create account
          </v-btn>

          <v-btn variant="text" block class="mt-2" to="/login">
            Back to login
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { register } from "../services/api";

const emit = defineEmits(["auth-changed"]);
const router = useRouter();

const username = ref("");
const password = ref("");
const requested = ref(null);
const message = ref("");
const loading = ref(false);
const error = ref("");

const roleOptions = [
  { label: "Member (default)", value: null },
  { label: "Request Admin (needs approval)", value: "admin" },
];

async function doRegister() {
  error.value = "";
  const u = username.value.trim();

  if (u.length < 3) return (error.value = "Username must be at least 3 characters.");
  if (password.value.length < 8) return (error.value = "Password must be at least 8 characters.");

  loading.value = true;
  try {
    await register({
      username: u,
      password: password.value,
      requested_rank: requested.value,
      message: message.value,
    });
    emit("auth-changed");
    router.push("/announcements");
  } catch (e) {
    error.value = e?.message || "Register failed.";
  } finally {
    loading.value = false;
  }
}
</script>
