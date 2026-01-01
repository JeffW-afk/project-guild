import { createRouter, createWebHistory } from "vue-router";

import LoginView from "../views/LoginView.vue";
import AnnouncementsView from "../views/AnnouncementsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/announcements" },
    { path: "/login", component: LoginView },
    { path: "/announcements", component: AnnouncementsView },
  ],
});
