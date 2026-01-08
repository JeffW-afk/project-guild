<template>
  <v-container class="py-6" style="max-width: 1000px;">
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="text-h5 font-weight-bold">
        {{ myParty?.party ? `ᛝ${myParty.party.name}ᛝ` : "My Party" }}
      </div>
      <v-btn variant="text" :loading="loading" @click="load">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-card rounded="xl" elevation="1">
      <v-card-title>Your status</v-card-title>
      <v-card-text>
        <div v-if="myParty?.party">
          <div class="text-subtitle-1 font-weight-medium">
            ⤷ You’re in <strong>{{ myParty.party.name }}</strong>
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Role: {{ myParty.party.role }}
          </div>
        </div>

        <div v-else>
          <div class="text-subtitle-1 font-weight-medium">You’re unaffiliated</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            You can request to create a party. An admin/guild leader must approve it.
          </div>

          <!-- Show latest request -->
          <v-alert
            v-if="myRequest?.request"
            :type="myRequest.request.status === 'pending' ? 'info' : (myRequest.request.status === 'approved' ? 'success' : 'warning')"
            variant="tonal"
            class="mt-4"
          >
            <div class="font-weight-medium">Latest request</div>
            <div class="text-body-2">
              <strong>{{ myRequest.request.party_name }}</strong>
              • {{ myRequest.request.status }}
            </div>
          </v-alert>

          <!-- Request form (only if no pending) -->
          <div v-if="!hasPendingRequest" class="mt-4">
            <v-text-field
              v-model="draft.party_name"
              label="Party name"
              variant="outlined"
              class="mb-3"
            />
            <v-textarea
              v-model="draft.message"
              label="Message (optional)"
              variant="outlined"
              rows="3"
            />

            <div class="d-flex justify-end mt-3">
              <v-btn
                color="primary"
                variant="flat"
                :loading="requesting"
                @click="submitRequest"
              >
                Request party
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-if="myParty?.party && myParty.party.role === 'captain'" rounded="xl" elevation="1" class="mt-6">
      <v-card-title>Join requests</v-card-title>
      <v-card-text>
        <v-alert v-if="joinError" type="error" variant="tonal" class="mb-4">
          {{ joinError }}
        </v-alert>

        <v-alert v-if="joinRequests.length === 0" type="info" variant="tonal">
          No pending join requests.
        </v-alert>

        <v-list v-else density="comfortable">
          <v-list-item
            v-for="r in joinRequests"
            :key="r.id"
            :title="r.username"
            :subtitle="r.message || '—'"
          >
            <template #append>
              <div class="d-flex align-center ga-2">
                <v-btn
                  size="small"
                  color="success"
                  variant="tonal"
                  :loading="actingId === r.id"
                  @click="approve(r.id)"
                >
                  Approve
                </v-btn>
                <v-btn
                  size="small"
                  color="error"
                  variant="tonal"
                  :loading="actingId === r.id"
                  @click="reject(r.id)"
                >
                  Reject
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  getMyParty,
  getMyPartyRequest,
  requestPartyCreation,
  listJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from "../services/api";

const loading = ref(false);
const error = ref("");

const myParty = ref(null);   // { party: ...|null }
const myRequest = ref(null); // { request: ...|null }

const joinRequests = ref([]);
const joinError = ref("");
const actingId = ref(null);

const draft = ref({ party_name: "", message: "" });
const requesting = ref(false);

const hasPendingRequest = computed(
  () => myRequest.value?.request?.status === "pending"
);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    myParty.value = await getMyParty();
    myRequest.value = await getMyPartyRequest();

    joinRequests.value = [];
    joinError.value = "";
    if (myParty.value?.party && myParty.value.party.role === 'captain') {
      joinRequests.value = await listJoinRequests('pending');
    }
  } catch (e) {
    error.value = e?.message || "Failed to load party status.";
  } finally {
    loading.value = false;
  }
}

async function submitRequest() {
  error.value = "";
  const name = draft.value.party_name.trim();
  if (name.length < 3) {
    error.value = "Party name must be at least 3 characters.";
    return;
  }

  requesting.value = true;
  try {
    await requestPartyCreation({
      party_name: name,
      message: draft.value.message.trim() || null,
    });
    draft.value = { party_name: "", message: "" };
    myRequest.value = await getMyPartyRequest();
  } catch (e) {
    error.value = e?.message || "Request failed";
  } finally {
    requesting.value = false;
  }
}



async function refreshJoinRequests() {
  joinError.value = "";
  try {
    joinRequests.value = await listJoinRequests("pending");
  } catch (e) {
    joinError.value = e?.message || "Failed to load join requests.";
  }
}

async function approve(id) {
  if (actingId.value) return;
  actingId.value = id;
  joinError.value = "";
  try {
    await approveJoinRequest(id);
    await refreshJoinRequests();
  } catch (e) {
    joinError.value = e?.message || "Approve failed.";
  } finally {
    actingId.value = null;
  }
}

async function reject(id) {
  if (actingId.value) return;
  actingId.value = id;
  joinError.value = "";
  try {
    await rejectJoinRequest(id);
    await refreshJoinRequests();
  } catch (e) {
    joinError.value = e?.message || "Reject failed.";
  } finally {
    actingId.value = null;
  }
}

onMounted(load);
</script>
