<template>
  <v-app>
    <v-app-bar elevation="1">
      <v-app-bar-title>My Guild</v-app-bar-title>
      <v-spacer />
      <v-btn variant="text" to="/announcements">Announcements</v-btn>
      <v-btn variant="text" to="/login">Login</v-btn>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
