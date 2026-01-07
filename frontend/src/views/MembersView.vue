<template>
  <v-container class="py-6" style="max-width: 1000px;">
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="text-h5 font-weight-bold">Members</div>
      <v-btn variant="text" :loading="loading" @click="load">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-card rounded="xl" elevation="1">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Guild roster</span>
        <v-chip size="small" variant="tonal">{{ filtered.length }} total</v-chip>
      </v-card-title>

      <v-card-text>
        <v-text-field
          v-model="q"
          label="Search by name or party"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          class="mb-4"
        />

        <v-table>
          <thead>
            <tr>
              <th style="width: 56px;">#</th>
              <th>Name</th>
              <th>Rank</th>
              <th>Affiliation</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(m, i) in filtered" :key="m.id">
              <td>{{ i + 1 }}</td>

              <td class="font-weight-medium">
                {{ m.username }}
              </td>

              <td>
                <v-chip size="small" variant="tonal">
                  {{ prettyRank(m.guild_rank) }}
                </v-chip>
              </td>

              <td>
                <v-chip v-if="m.party" size="small" variant="tonal">
                  {{ m.party.name }}
                </v-chip>
                <span v-else class="text-medium-emphasis">Unaffiliated</span>
              </td>
            </tr>
          </tbody>
        </v-table>

        <v-alert v-if="filtered.length === 0" type="info" variant="tonal" class="mt-4">
          No members found.
        </v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { listMembers } from "../services/api";

const loading = ref(false);
const error = ref("");
const members = ref([]);
const q = ref("");

function rankPriority(rank) {
  switch (rank) {
    case "founder": return 0;
    case "guild_master": return 1;
    case "admin": return 2;
    case "member": return 3;
    default: return 99;
  }
}

function prettyRank(rank) {
  if (!rank) return "Member";
  return rank.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

const filtered = computed(() => {
  const query = q.value.trim().toLowerCase();

  const sorted = [...members.value].sort((a, b) => {
    const pr = rankPriority(a.guild_rank) - rankPriority(b.guild_rank);
    if (pr !== 0) return pr;
    return (a.username || "").localeCompare(b.username || "");
  });

  if (!query) return sorted;

  return sorted.filter(m => {
    const name = (m.username || "").toLowerCase();
    const party = (m.party?.name || "").toLowerCase();
    return name.includes(query) || party.includes(query);
  });
});

async function load() {
  error.value = "";
  loading.value = true;
  try {
    members.value = await listMembers();
  } catch (e) {
    error.value = e?.message || "Failed to load members.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
