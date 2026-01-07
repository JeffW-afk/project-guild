<template>
  <v-container class="py-6" style="max-width: 1000px;">
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="d-flex align-center ga-3">
        <div class="text-h5 font-weight-bold">Mailbox</div>
        <v-chip size="small" variant="tonal">
          {{ unreadCount }} unread
        </v-chip>
      </div>

      <div class="d-flex ga-2">
        <v-btn variant="tonal" @click="composeDialog = true">
          New message
        </v-btn>
        <v-btn variant="text" :loading="loading" @click="load">Refresh</v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-card rounded="xl" elevation="1">
      <v-tabs v-model="tab" bg-color="transparent">
        <v-tab value="inbox">Inbox</v-tab>
        <v-tab value="sent">Sent</v-tab>
      </v-tabs>

      <v-divider />

      <v-card-text>
        <v-window v-model="tab">
          <!-- INBOX -->
          <v-window-item value="inbox">
            <v-alert v-if="inbox.length === 0" type="info" variant="tonal">
              No messages yet.
            </v-alert>

            <v-list v-else density="comfortable">
              <v-list-item
                v-for="m in inbox"
                :key="m.id"
                :title="m.subject"
                :subtitle="subtitleInbox(m)"
                @click="openMessage(m, 'inbox')"
              >
                <template #prepend>
                  <v-icon :color="m.is_read ? undefined : 'primary'">
                    {{ m.is_read ? 'mdi-email-open-outline' : 'mdi-email-outline' }}
                  </v-icon>
                </template>

                <template #append>
                  <v-chip v-if="!m.is_read" size="small" color="primary" variant="tonal">
                    Unread
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-window-item>

          <!-- SENT -->
          <v-window-item value="sent">
            <v-alert v-if="sent.length === 0" type="info" variant="tonal">
              You haven't sent any messages.
            </v-alert>

            <v-list v-else density="comfortable">
              <v-list-item
                v-for="m in sent"
                :key="m.id"
                :title="m.subject"
                :subtitle="subtitleSent(m)"
                @click="openMessage(m, 'sent')"
              >
                <template #prepend>
                  <v-icon>mdi-send</v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>

    <!-- READ MESSAGE DIALOG -->
    <v-dialog v-model="readDialog" max-width="700">
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>{{ activeMessage?.subject }}</span>
          <v-btn icon="mdi-close" variant="text" @click="readDialog = false" />
        </v-card-title>
        <v-card-subtitle class="px-4 pb-0">
          <div class="text-caption text-medium-emphasis">
            <span v-if="activeBox === 'inbox'">
              From: <strong>{{ activeMessageFrom }}</strong>
            </span>
            <span v-else>
              To: <strong>{{ activeMessageTo }}</strong>
            </span>
            • {{ activeMessage?.created_at }}
          </div>
        </v-card-subtitle>
        <v-card-text>
          <pre style="white-space: pre-wrap; font-family: inherit;">{{ activeMessage?.body }}</pre>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="readDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- COMPOSE -->
    <v-dialog v-model="composeDialog" max-width="700">
      <v-card rounded="xl">
        <v-card-title>New message</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" class="mb-4">
            Members can message leaders (admin/guild_master/founder). Leaders can message anyone.
          </v-alert>

          <v-text-field v-model="draft.toUsername" label="To (username)" variant="outlined" class="mb-2" />
          <v-text-field v-model="draft.subject" label="Subject" variant="outlined" class="mb-2" />
          <v-textarea v-model="draft.body" label="Message" variant="outlined" rows="6" />
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="composeDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="sending" @click="send">
            Send
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  getUnreadMailCount,
  listInbox,
  listSent,
  markMailRead,
  sendMail,
} from "../services/api";

const tab = ref("inbox");
const loading = ref(false);
const error = ref("");

const unreadCount = ref(0);
const inbox = ref([]);
const sent = ref([]);

const readDialog = ref(false);
const activeMessage = ref(null);
const activeBox = ref("inbox");

const composeDialog = ref(false);
const sending = ref(false);
const draft = ref({ toUsername: "", subject: "", body: "" });

const activeMessageFrom = computed(() => {
  const m = activeMessage.value;
  if (!m) return "";
  return m.from?.username || "System";
});

const activeMessageTo = computed(() => {
  const m = activeMessage.value;
  if (!m) return "";
  return m.to?.username || "";
});

function subtitleInbox(m) {
  const from = m.from?.username || "System";
  return `${from} • ${m.created_at}`;
}

function subtitleSent(m) {
  const to = m.to?.username || "(unknown)";
  return `To: ${to} • ${m.created_at}`;
}

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const [count, inboxRows, sentRows] = await Promise.all([
      getUnreadMailCount(),
      listInbox({ limit: 100 }),
      listSent({ limit: 100 }),
    ]);
    unreadCount.value = count.unread || 0;
    inbox.value = inboxRows;
    sent.value = sentRows;
  } catch (e) {
    error.value = e?.message || "Failed to load mailbox";
  } finally {
    loading.value = false;
  }
}

async function openMessage(m, box) {
  activeMessage.value = m;
  activeBox.value = box;
  readDialog.value = true;

  // mark as read when opening inbox message
  if (box === "inbox" && m && !m.is_read) {
    try {
      await markMailRead(m.id);
      // update local state
      m.is_read = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch {
      // ignore (message still opens)
    }
  }
}

async function send() {
  error.value = "";
  const toUsername = draft.value.toUsername.trim();
  const subject = draft.value.subject.trim();
  const body = draft.value.body.trim();

  if (!toUsername) return (error.value = "Please enter a username to send to.");
  if (!subject) return (error.value = "Please enter a subject.");
  if (!body) return (error.value = "Please write a message.");

  sending.value = true;
  try {
    await sendMail({ toUsername, subject, body });
    composeDialog.value = false;
    draft.value = { toUsername: "", subject: "", body: "" };
    await load();
    tab.value = "sent";
  } catch (e) {
    error.value = e?.message || "Failed to send";
  } finally {
    sending.value = false;
  }
}

onMounted(load);
</script>
