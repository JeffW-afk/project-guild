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
            class="mb-2"
            @keyup.enter="doLogin"
          />

          <div class="d-flex justify-end mb-4">
            <v-btn variant="text" size="small" @click="openReset">
              Forgot password?
            </v-btn>
          </div>

          <v-btn color="primary" variant="flat" block :loading="loading" @click="doLogin">
            Log in
          </v-btn>
        </v-card>
      </v-col>
    </v-row>

    <!-- Forgot password dialog -->
    <v-dialog v-model="resetDialog" max-width="520">
      <v-card rounded="xl" class="pa-2">
        <v-card-title class="text-h6">Reset password</v-card-title>

        <v-card-text>
          <v-alert v-if="resetMsg" type="success" variant="tonal" class="mb-3">
            {{ resetMsg }}
          </v-alert>

          <v-alert v-if="resetErr" type="error" variant="tonal" class="mb-3">
            {{ resetErr }}
          </v-alert>

          <v-text-field
            v-model="resetUsername"
            label="Username"
            variant="outlined"
            autocomplete="username"
            class="mb-3"
          />

          <!-- Step 1: request code -->
          <div v-if="!codeSent">
            <div class="text-caption text-medium-emphasis mb-2">
              We’ll generate a reset code (for now it shows in your backend terminal).
            </div>

            <v-btn
              color="primary"
              variant="flat"
              block
              :loading="resetLoading"
              @click="sendResetCode"
            >
              Send reset code
            </v-btn>
          </div>

          <!-- Step 2: enter code + new password -->
          <div v-else>
            <v-text-field
              v-model="resetCode"
              label="Reset code"
              variant="outlined"
              class="mb-3"
            />

            <v-text-field
              v-model="newPassword"
              label="New password"
              type="password"
              variant="outlined"
              class="mb-3"
            />

            <v-text-field
              v-model="newPassword2"
              label="Confirm new password"
              type="password"
              variant="outlined"
              class="mb-2"
              @keyup.enter="confirmReset"
            />

            <v-btn
              color="primary"
              variant="flat"
              block
              :loading="resetLoading"
              @click="confirmReset"
            >
              Reset password
            </v-btn>

            <v-btn variant="text" block class="mt-2" @click="startOver">
              Start over
            </v-btn>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeReset">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login, requestPasswordReset, resetPassword } from "../services/api";

const emit = defineEmits(["auth-changed"]);
const router = useRouter();

const username = ref("admin");
const password = ref("");
const loading = ref(false);
const error = ref("");

// Reset dialog state
const resetDialog = ref(false);
const resetUsername = ref("admin");
const resetCode = ref("");
const newPassword = ref("");
const newPassword2 = ref("");
const resetLoading = ref(false);
const resetErr = ref("");
const resetMsg = ref("");
const codeSent = ref(false);

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

function openReset() {
  resetDialog.value = true;
  // Prefill with whatever they typed in login
  resetUsername.value = username.value || "admin";
  resetErr.value = "";
  resetMsg.value = "";
  resetCode.value = "";
  newPassword.value = "";
  newPassword2.value = "";
  codeSent.value = false;
}

function closeReset() {
  resetDialog.value = false;
}

function startOver() {
  resetErr.value = "";
  resetMsg.value = "";
  resetCode.value = "";
  newPassword.value = "";
  newPassword2.value = "";
  codeSent.value = false;
}

async function sendResetCode() {
  resetErr.value = "";
  resetMsg.value = "";

  if (!resetUsername.value.trim()) {
    resetErr.value = "Please enter a username.";
    return;
  }

  resetLoading.value = true;
  try {
    await requestPasswordReset(resetUsername.value.trim());
    codeSent.value = true;
    resetMsg.value =
      "Reset code requested. Check your backend terminal for the code (valid ~10 minutes).";
  } catch (e) {
    resetErr.value = e.message || "Failed to request reset code.";
  } finally {
    resetLoading.value = false;
  }
}

async function confirmReset() {
  resetErr.value = "";
  resetMsg.value = "";

  if (!resetCode.value.trim()) {
    resetErr.value = "Please enter the reset code.";
    return;
  }
  if (newPassword.value.length < 8) {
    resetErr.value = "Password must be at least 8 characters.";
    return;
  }
  if (newPassword.value !== newPassword2.value) {
    resetErr.value = "Passwords do not match.";
    return;
  }

  resetLoading.value = true;
  try {
    await resetPassword({
      username: resetUsername.value.trim(),
      code: resetCode.value.trim(),
      newPassword: newPassword.value,
    });

    resetMsg.value = "Password reset! You can now log in with the new password.";
    // Optional: autofill the login form
    username.value = resetUsername.value.trim();
    password.value = "";
  } catch (e) {
    resetErr.value = e.message || "Reset failed.";
  } finally {
    resetLoading.value = false;
  }
}
</script>
