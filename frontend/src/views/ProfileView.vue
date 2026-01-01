<template>
  <v-container class="py-6" style="max-width: 900px;">
    <v-card rounded="xl" elevation="1" class="pa-4">
      <div class="text-h5 font-weight-bold mb-2">Profile</div>

      <v-alert v-if="success" type="success" variant="tonal" class="mb-4">
        {{ success }}
      </v-alert>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
        {{ error }}
      </v-alert>

      <div v-if="user" class="mb-4 text-body-2 text-medium-emphasis">
        Logged in as <b>{{ user.username }}</b> ({{ user.role }})
      </div>

      <v-text-field
        v-model="form.username"
        label="New username"
        variant="outlined"
        class="mb-2"
      />

      <v-text-field
        v-model="form.currentPassword"
        label="Current password (required)"
        type="password"
        variant="outlined"
        class="mb-2"
      />

      <v-text-field
        v-model="form.newPassword"
        label="New password (optional)"
        type="password"
        variant="outlined"
        class="mb-4"
      />

      <v-btn color="primary" variant="flat" :loading="saving" @click="save">
        Save changes
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { authMe, updateProfile } from "../services/api";

const user = ref(null);
const saving = ref(false);
const error = ref("");
const success = ref("");

const form = ref({
  username: "",
  currentPassword: "",
  newPassword: "",
});

async function loadUser() {
  const res = await authMe();
  user.value = res.user;
  form.value.username = user.value?.username || "";
}

async function save() {
  error.value = "";
  success.value = "";

  if (!form.value.currentPassword) {
    error.value = "Current password is required.";
    return;
  }

  saving.value = true;
  try {
    const updated = await updateProfile({
      username: form.value.username,
      currentPassword: form.value.currentPassword,
      newPassword: form.value.newPassword,
    });

    user.value = updated;
    form.value.currentPassword = "";
    form.value.newPassword = "";
    success.value = "Profile updated!";
  } catch (e) {
    error.value = e.message || "Update failed";
  } finally {
    saving.value = false;
  }
}

onMounted(loadUser);
</script>
