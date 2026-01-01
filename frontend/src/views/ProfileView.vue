<template>
  <v-container class="py-6" style="max-width: 900px;">
    <v-card rounded="xl" elevation="1" class="pa-4">
      <div class="text-h5 font-weight-bold mb-2">Profile</div>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
        {{ error }}
      </v-alert>

      <template v-if="user">
        <div class="text-body-1">Username: <b>{{ user.username }}</b></div>
        <div class="text-body-1">Role: <b>{{ user.role }}</b></div>
      </template>

      <template v-else>
        <div class="text-body-2 text-medium-emphasis">
          Loading…
        </div>
      </template>
    </v-card>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { authMe } from "../services/api";

const user = ref(null);
const error = ref("");

onMounted(async () => {
  try {
    const res = await authMe();
    user.value = res.user;
  } catch {
    error.value = "Failed to load profile.";
  }
});
</script>
