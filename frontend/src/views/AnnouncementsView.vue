<template>
  <v-container class="py-6" style="max-width: 900px;">
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="text-h5 font-weight-bold">Announcements</div>

      <v-btn v-if="canPost" color="primary" variant="flat" @click="dialog = true">
        Post
      </v-btn>
    </div>

    <v-alert v-if="!canPost" type="info" variant="tonal" class="mb-4">
      Only admin can post announcements.
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-card v-for="a in announcements" :key="a.id" class="mb-4" rounded="xl" elevation="1">
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <div class="text-h6">{{ a.title }}</div>
          <div class="text-caption text-medium-emphasis">
            by {{ a.author }} • {{ a.date }}
          </div>
        </div>
        <v-chip size="small" variant="tonal">{{ a.tag }}</v-chip>
      </v-card-title>
      <v-card-text>{{ a.body }}</v-card-text>
    </v-card>

    <v-dialog v-model="dialog" max-width="600">
      <v-card rounded="xl">
        <v-card-title class="text-h6">Post announcement</v-card-title>
        <v-card-text>
          <v-text-field v-model="draft.title" label="Title" variant="outlined" class="mb-3" />
          <v-textarea v-model="draft.body" label="Body" variant="outlined" rows="4" />
          <v-select
            v-model="draft.tag"
            :items="['General', 'Raid', 'Event', 'Reminder']"
            label="Tag"
            variant="outlined"
            class="mt-3"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="posting" @click="post">
            Post
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { authMe, listAnnouncements, createAnnouncement } from "../services/api";

const user = ref(null);
const announcements = ref([]);
const error = ref("");

const dialog = ref(false);
const posting = ref(false);
const draft = ref({ title: "", body: "", tag: "General" });

const canPost = computed(() => user.value?.role === "admin");

async function load() {
  error.value = "";
  try {
    const me = await authMe();
    user.value = me.user;
    announcements.value = await listAnnouncements();
  } catch (e) {
    error.value = "Failed to load announcements (are you logged in?)";
  }
}

async function post() {
  if (!canPost.value) return;
  const title = draft.value.title.trim();
  const body = draft.value.body.trim();
  if (!title || !body) return;

  posting.value = true;
  try {
    const created = await createAnnouncement({ title, body, tag: draft.value.tag });
    announcements.value = [created, ...announcements.value];
    draft.value = { title: "", body: "", tag: "General" };
    dialog.value = false;
  } catch {
    error.value = "Post failed (maybe not logged in as admin).";
  } finally {
    posting.value = false;
  }
}

onMounted(load);
</script>
