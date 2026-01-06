<template>
  <v-container class="py-6" style="max-width: 1000px;">
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="text-h5 font-weight-bold">Party Requests</div>
      <v-btn variant="text" :loading="loading" @click="load">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-alert v-if="!isAdmin" type="warning" variant="tonal">
      You don’t have access to this page.
    </v-alert>

    <v-card v-else rounded="xl" elevation="1">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Pending requests</span>
        <v-chip size="small" variant="tonal">{{ requests.length }} pending</v-chip>
      </v-card-title>

      <v-card-text>
        <v-alert v-if="requests.length === 0" type="info" variant="tonal">
          No pending requests.
        </v-alert>

        <v-card
          v-for="r in requests"
          :key="r.id"
          rounded="xl"
          elevation="0"
          class="mb-3"
          style="border: 1px solid rgba(255,255,255,0.12);"
        >
          <v-card-title class="d-flex align-center justify-space-between">
            <div>
              <div class="text-subtitle-1 font-weight-medium">{{ r.party_name }}</div>
              <div class="text-caption text-medium-emphasis">
                requested by {{ r.user.username }} • {{ r.created_at }}
              </div>
            </div>

            <div class="d-flex ga-2">
              <v-btn
                color="primary"
                variant="flat"
                size="small"
                :loading="approvingId === r.id"
                @click="approve(r.id)"
              >
                Approve
              </v-btn>
              <v-btn
                color="error"
                variant="tonal"
                size="small"
                :loading="rejectingId === r.id"
                @click="reject(r.id)"
              >
                Reject
              </v-btn>
            </div>
          </v-card-title>

          <v-card-text v-if="r.message" class="pt-0">
            <div class="text-body-2">{{ r.message }}</div>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { authMe, listPartyRequests, approvePartyRequest, rejectPartyRequest } from "../services/api";

const user = ref(null);
const loading = ref(false);
const error = ref("");

const requests = ref([]);
const approvingId = ref(null);
const rejectingId = ref(null);

const isAdmin = computed(() =>
  ["admin", "guild_master", "founder"].includes(user.value?.guild_rank)
);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const me = await authMe();
    user.value = me.user;

    if (isAdmin.value) {
      requests.value = await listPartyRequests("pending");
    } else {
      requests.value = [];
    }
  } catch (e) {
    error.value = e?.message || "Failed to load requests.";
  } finally {
    loading.value = false;
  }
}

async function approve(id) {
  approvingId.value = id;
  error.value = "";
  try {
    await approvePartyRequest(id);
    await load();
  } catch (e) {
    error.value = e?.message || "Approve failed";
  } finally {
    approvingId.value = null;
  }
}

async function reject(id) {
  rejectingId.value = id;
  error.value = "";
  try {
    await rejectPartyRequest(id);
    await load();
  } catch (e) {
    error.value = e?.message || "Reject failed";
  } finally {
    rejectingId.value = null;
  }
}

onMounted(load);
</script>
