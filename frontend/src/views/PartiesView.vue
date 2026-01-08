<template>
  <v-container class="py-6" style="max-width: 1000px;">
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="text-h5 font-weight-bold">Parties</div>
      <v-btn variant="text" :loading="loading" @click="load">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-card rounded="xl" elevation="1">
      <v-card-title>All parties</v-card-title>
      <v-card-text>
        <v-alert v-if="parties.length === 0" type="info" variant="tonal">
          No parties yet.
        </v-alert>

        <v-list v-else density="comfortable">
          <v-list-item
            v-for="p in parties"
            :key="p.id"
            :title="p.name"
            :subtitle="p.description || '—'"
            @click="openInfo(p)"
          >
            <template #append>
              <div class="d-flex align-center ga-2">
                <v-chip size="small" variant="tonal">
                  {{ p.member_count }} members
                </v-chip>

                <v-btn
                  v-if="canRemoveParties"
                  size="small"
                  color="error"
                  variant="tonal"
                  @click.stop="openRemove(p)"
                >
                  Remove
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Remove dialog -->
    <v-dialog v-model="removeDialog" max-width="520">
      <v-card rounded="xl">
        <v-card-title>Remove party</v-card-title>
        <v-card-text>
          <div>
            Are you sure you want to remove <strong>{{ selectedParty?.name }}</strong>?
          </div>
          <div class="text-body-2 text-medium-emphasis mt-2">
            This will disband the party and unaffiliate all members.
          </div>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="removeDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="removing"
            @click="confirmRemove"
          >
            Remove
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- Party info / Join dialog -->
    <v-dialog v-model="infoDialog" max-width="560">
      <v-card rounded="xl">
        <v-card-title>{{ infoParty?.name }}</v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis">
            {{ infoParty?.description || "No description." }}
          </div>

          <div class="mt-4 d-flex align-center ga-2">
            <v-chip size="small" variant="tonal">
              {{ infoParty?.member_count ?? 0 }} members
            </v-chip>
          </div>

          <v-alert v-if="joinError" type="error" variant="tonal" class="mt-4">
            {{ joinError }}
          </v-alert>

          <v-alert v-else-if="myParty?.party" type="info" variant="tonal" class="mt-4">
            You’re already in a party.
          </v-alert>

          <v-alert
            v-else-if="myJoinRequest?.request?.status === 'pending'"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            You already have a pending join request (to {{ myJoinRequest.request.party_name }}).
          </v-alert>

          <div v-else class="mt-4">
            <v-textarea
              v-model="joinMessage"
              label="Message (optional)"
              variant="outlined"
              rows="3"
            />
          </div>
        </v-card-text>

        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="infoDialog = false">Close</v-btn>

          <v-btn
            v-if="canRequestJoin"
            color="primary"
            variant="flat"
            :loading="joining"
            @click="submitJoin"
          >
            Request to join
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  authMe,
  listParties,
  deleteParty,
  getMyParty,
  getMyPartyJoinRequest,
  requestJoinParty,
} from "../services/api";

const loading = ref(false);
const removing = ref(false);
const error = ref("");

const parties = ref([]);
const me = ref(null);

const removeDialog = ref(false);
const selectedParty = ref(null);

const canRemoveParties = computed(() => {
  const rank = me.value?.user?.guild_rank;
  return ["admin", "guild_master", "founder"].includes(rank);
});

const myParty = ref(null);
const myJoinRequest = ref(null);

const infoDialog = ref(false);
const infoParty = ref(null);

const joinMessage = ref("");
const joinError = ref("");
const joining = ref(false);

const canRequestJoin = computed(() => {
  const unaffiliated = !myParty.value?.party;
  const noPending = myJoinRequest.value?.request?.status !== "pending";
  return unaffiliated && noPending && !!infoParty.value;
});

function openInfo(party) {
  infoParty.value = party;
  joinMessage.value = "";
  joinError.value = "";
  infoDialog.value = true;
}

function openRemove(party) {
  selectedParty.value = party;
  removeDialog.value = true;
}

async function confirmRemove() {
  if (!selectedParty.value) return;

  removing.value = true;
  error.value = "";
  try {
    await deleteParty(selectedParty.value.id);
    removeDialog.value = false;
    selectedParty.value = null;
    await load();
  } catch (e) {
    error.value = e?.message || "Failed to remove party.";
  } finally {
    removing.value = false;
  }
}

async function load() {
  error.value = "";
  loading.value = true;
  try {
    me.value = await authMe();
    parties.value = await listParties();
    myParty.value = await getMyParty();
    myJoinRequest.value = await getMyPartyJoinRequest();
  } catch (e) {
    error.value = e?.message || "Failed to load parties.";
  } finally {
    loading.value = false;
  }
}

async function submitJoin() {
  if (!infoParty.value) return;

  joining.value = true;
  joinError.value = "";
  try {
    await requestJoinParty(infoParty.value.id, { message: joinMessage.value });
    myJoinRequest.value = await getMyPartyJoinRequest();
    infoDialog.value = false;
  } catch (e) {
    joinError.value = e?.message || "Failed to request join.";
  } finally {
    joining.value = false;
  }
}

onMounted(load);
</script>
