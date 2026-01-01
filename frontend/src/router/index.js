import { createRouter, createWebHistory } from "vue-router";

import LoginView from "../views/LoginView.vue";
import AnnouncementsView from "../views/AnnouncementsView.vue";
import MembersView from "../views/MembersView.vue";
import PartiesView from "../views/PartiesView.vue";
import ProfileView from "../views/ProfileView.vue";

import { authMe } from "../services/api";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/announcements" },

    // public pages
    { path: "/login", component: LoginView },
    { path: "/announcements", component: AnnouncementsView },

    // protected pages
    { path: "/members", component: MembersView, meta: { requiresAuth: true } },
    { path: "/parties", component: PartiesView, meta: { requiresAuth: true } },
    { path: "/profile", component: ProfileView, meta: { requiresAuth: true } },

    // fallback (optional)
    { path: "/:pathMatch(.*)*", redirect: "/announcements" },
  ],
});

// Route guard: if route requires auth, check session; otherwise allow
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;

  try {
    const res = await authMe();
    if (res.user) return true;
  } catch (e) {
    // ignore
  }

  return "/login";
});

export { router };
