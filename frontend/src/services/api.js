// src/services/api.js
const USE_REAL_BACKEND = true; // later we'll switch this to true

// Fake in-memory "database" for now:
let announcements = [
  {
    id: 1,
    title: "Raid Night Schedule",
    body: "Raid starts Friday 9:00 PM. Be online 15 minutes early for invites.",
    author: "Rin (Guildmaster)",
    date: "Dec 31, 2025",
    tag: "Raid",
  },
  {
    id: 2,
    title: "Welcome New Members!",
    body: "Welcome to the guild! Check the Members tab for ranks and roles.",
    author: "Kai (Officer)",
    date: "Dec 29, 2025",
    tag: "General",
    
  },
  {
    id: 3,
    title: "Welcome New Members!",
    body: "Welcome to the guild! Check the Members tab for ranks and roles.",
    author: "Kai (Officer)",
    date: "Dec 29, 2025",
    tag: "General",
    
  },
];

async function delay(ms = 200) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function listAnnouncements() {
  if (!USE_REAL_BACKEND) {
    await delay();
    return announcements;
  }

  const res = await fetch("/api/announcements", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load announcements");
  return await res.json();
}

export async function createAnnouncement(input) {
  if (!USE_REAL_BACKEND) {
    await delay();
    const a = {
      id: Date.now(),
      title: input.title,
      body: input.body,
      author: input.author ?? "You",
      date: new Date().toLocaleDateString(),
      tag: input.tag ?? "General",
    };
    announcements = [a, ...announcements];
    return a;
  }

  const res = await fetch("/api/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to create announcement");
  return await res.json();
}

export async function deleteAnnouncement(id) {
  const res = await fetch(`/api/announcements/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Delete failed");
  }

  return await res.json();
}

export async function authMe() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Failed auth/me");
  return await res.json(); // { user: ... or null }
}

export async function login(username, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid login");
  return await res.json();
}

export async function logout() {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Logout failed");
  return await res.json();
}

export async function updateProfile({ username, currentPassword, newPassword }) {
  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, currentPassword, newPassword }),
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Update failed");
  }

  return await res.json();
}

export async function requestPasswordReset(username) {
  const res = await fetch("/api/auth/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Failed to request reset");
  }
  return await res.json();
}

export async function resetPassword({ username, code, newPassword }) {
  const res = await fetch("/api/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, code, newPassword }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Reset failed");
  }
  return await res.json();
}

// ---------------------------
// Parties
// ---------------------------

export async function listParties() {
  const res = await fetch("/api/parties", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load parties");
  return await res.json();
}

export async function getMyParty() {
  const res = await fetch("/api/parties/me", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load your party");
  return await res.json(); // { party: ... or null }
}

export async function getMyPartyRequest() {
  const res = await fetch("/api/parties/requests/me", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load your party request");
  return await res.json(); // { request: ... or null }
}

export async function requestPartyCreation({ party_name, message }) {
  const res = await fetch("/api/parties/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ party_name, message }),
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Failed to create request");
  }

  return await res.json();
}

export async function listPartyRequests(status = "pending") {
  const res = await fetch(`/api/parties/requests?status=${encodeURIComponent(status)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load party requests");
  return await res.json();
}

export async function approvePartyRequest(id) {
  const res = await fetch(`/api/parties/requests/${id}/approve`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Approve failed");
  }

  return await res.json();
}

export async function rejectPartyRequest(id) {
  const res = await fetch(`/api/parties/requests/${id}/reject`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Reject failed");
  }

  return await res.json();
}

export async function deleteParty(id) {
  const res = await fetch(`/api/parties/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Remove failed");
  }

  return await res.json();
}

export async function register({ username, password, requested_rank, message }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password, requested_rank, message }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Register failed");
  return data; // { user, requested_admin }
}

export async function listMembers() {
  const res = await fetch("/api/members", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load members");
  return await res.json();
}

export async function getMyRankRequest() {
  const res = await fetch("/api/members/rank-requests/me", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load your rank request");
  return await res.json();
}

export async function listRankRequests(status = "pending") {
  const res = await fetch(`/api/members/rank-requests?status=${encodeURIComponent(status)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load rank requests");
  return await res.json();
}

export async function approveRankRequest(id) {
  const res = await fetch(`/api/members/rank-requests/${id}/approve`, {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Approve failed");
  return data;
}

export async function rejectRankRequest(id) {
  const res = await fetch(`/api/members/rank-requests/${id}/reject`, {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Reject failed");
  return data;
}


