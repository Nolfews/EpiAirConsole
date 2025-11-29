"use strict";
var FriendsClient = (() => {
  // src/friendsClient.ts
  var FriendsManager = class {
    constructor() {
      this.token = null;
      this.socket = null;
      this.friends = [];
      this.requests = [];
      this.invitations = [];
      this.onlineUsers = /* @__PURE__ */ new Set();
      this.currentRoomId = null;
      this.currentRoomPin = null;
      this.token = localStorage.getItem("authToken");
      this.init();
    }
    setSocket(socket) {
      this.socket = socket;
      this.setupSocketListeners();
    }
    setCurrentRoom(roomId, pin) {
      this.currentRoomId = roomId;
      this.currentRoomPin = pin;
      this.updateInviteButtons();
    }
    init() {
      if (!this.token) {
        return;
      }
      this.setupUI();
      this.loadFriends();
      this.loadFriendRequests();
      this.loadRoomInvitations();
    }
    setupUI() {
      const friendsToggle = document.getElementById("friendsToggle");
      const closeFriendsPanel = document.getElementById("closeFriendsPanel");
      const friendsPanel = document.getElementById("friendsPanel");
      const addFriendBtn = document.getElementById("addFriendBtn");
      const closeAddFriendModal = document.getElementById("closeAddFriendModal");
      const addFriendModal = document.getElementById("addFriendModal");
      const searchUserBtn = document.getElementById("searchUserBtn");
      const searchUserInput = document.getElementById("searchUserInput");
      friendsToggle?.addEventListener("click", () => {
        if (friendsPanel) {
          friendsPanel.style.display = friendsPanel.style.display === "none" ? "flex" : "none";
        }
      });
      closeFriendsPanel?.addEventListener("click", () => {
        if (friendsPanel) {
          friendsPanel.style.display = "none";
        }
      });
      document.querySelectorAll(".friends-tab").forEach((tab) => {
        tab.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const tabName = target.dataset.tab;
          document.querySelectorAll(".friends-tab").forEach((t) => t.classList.remove("active"));
          target.classList.add("active");
          document.querySelectorAll(".tab-pane").forEach((pane2) => pane2.classList.remove("active"));
          const pane = document.getElementById(`${tabName}Tab`);
          if (pane) {
            pane.classList.add("active");
          }
        });
      });
      addFriendBtn?.addEventListener("click", () => {
        if (addFriendModal) {
          addFriendModal.style.display = "flex";
        }
      });
      closeAddFriendModal?.addEventListener("click", () => {
        if (addFriendModal) {
          addFriendModal.style.display = "none";
        }
      });
      addFriendModal?.addEventListener("click", (e) => {
        if (e.target === addFriendModal) {
          addFriendModal.style.display = "none";
        }
      });
      searchUserBtn?.addEventListener("click", () => this.searchUsers());
      searchUserInput?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.searchUsers();
        }
      });
    }
    setupSocketListeners() {
      if (!this.socket) return;
      this.socket.on("friend_request_received", (data) => {
        console.log("Friend request received from:", data.senderUsername);
        this.loadFriendRequests();
        this.showNotification(`${data.senderUsername} sent you a friend request`);

        const requestsTabBtn = document.querySelector('[data-tab="requests"]');
        if (requestsTabBtn) {
          requestsTabBtn.click();
        }
      });
      this.socket.on("friend_request_accepted", (data) => {
        console.log("Friend request accepted by:", data.username);
        this.loadFriends();
        this.showNotification(`${data.username} accepted your friend request`);
      });
      this.socket.on("room_invitation_received", (data) => {
        console.log("Room invitation received from:", data.senderUsername);
        this.loadRoomInvitations();
        this.showNotification(`${data.senderUsername} invited you to join a room`);
      });
      this.socket.on("user_online", (data) => {
        this.onlineUsers.add(data.userId);
        this.updateOnlineStatus();
      });
      this.socket.on("user_offline", (data) => {
        this.onlineUsers.delete(data.userId);
        this.updateOnlineStatus();
      });
    }
    async apiCall(endpoint, method = "GET", body) {
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }
      const options = {
        method,
        headers
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(`/api${endpoint}`, options);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Request failed");
      }
      return response.json();
    }
    async loadFriends() {
      try {
        const data = await this.apiCall("/friends");
        this.friends = data.friends;
        this.renderFriends();
        this.updateNotificationBadge();
      } catch (err) {
        console.error("Failed to load friends:", err);
      }
    }
    async loadFriendRequests() {
      try {
        const data = await this.apiCall("/friends/requests");
        this.requests = data.requests;
        this.renderRequests();
        this.updateNotificationBadge();
      } catch (err) {
        console.error("Failed to load friend requests:", err);
      }
    }
    async loadRoomInvitations() {
      try {
        const data = await this.apiCall("/invitations/rooms");
        this.invitations = data.invitations;
        this.renderInvitations();
        this.updateNotificationBadge();
      } catch (err) {
        console.error("Failed to load room invitations:", err);
      }
    }
    renderFriends() {
      const friendsList = document.getElementById("friendsList");
      if (!friendsList) return;
      const friendsCount = document.getElementById("friendsCount");
      if (friendsCount) {
        friendsCount.textContent = this.friends.length.toString();
      }
      if (this.friends.length === 0) {
        friendsList.innerHTML = '<div class="empty-state"><p>No friends yet. Add friends to invite them to games!</p></div>';
        return;
      }
      friendsList.innerHTML = this.friends.map((friend) => {
        const isOnline = this.onlineUsers.has(friend.id);
        const displayName = friend.first_name || friend.username;
        const initials = displayName.substring(0, 2).toUpperCase();
        return `
        <div class="friend-card" data-friend-id="${friend.id}">
          <div class="friend-header">
            <div class="friend-avatar">${initials}</div>
            <div class="friend-info">
              <p class="friend-name">
                ${displayName}
                <span class="online-indicator ${isOnline ? "" : "offline"}"></span>
              </p>
              <p class="friend-username">@${friend.username}</p>
            </div>
          </div>
          <div class="friend-actions">
            <button class="invite-room-btn" data-friend-id="${friend.id}" ${!this.currentRoomId ? "disabled" : ""}>
              Invite to Room
            </button>
            <button class="remove-friend-btn" data-friend-id="${friend.id}">
              Remove
            </button>
          </div>
        </div>
      `;
      }).join("");
      friendsList.querySelectorAll(".invite-room-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const friendId = target.dataset.friendId;
          if (friendId) this.inviteToRoom(friendId);
        });
      });
      friendsList.querySelectorAll(".remove-friend-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const friendId = target.dataset.friendId;
          if (friendId && confirm("Remove this friend?")) {
            this.removeFriend(friendId);
          }
        });
      });

      this.updateInviteButtons();
    }
    renderRequests() {
      const requestsList = document.getElementById("requestsList");
      if (!requestsList) {
        return;
      }
      const requestsCount = document.getElementById("requestsCount");
      if (requestsCount) {
        requestsCount.textContent = this.requests.length.toString();
        requestsCount.style.display = this.requests.length > 0 ? "inline-block" : "none";
      }
      if (this.requests.length === 0) {
        requestsList.innerHTML = '<div class="empty-state"><p>No pending friend requests</p></div>';
        return;
      }
      requestsList.innerHTML = this.requests.map((request) => {
        const displayName = request.first_name || request.username;
        const initials = displayName.substring(0, 2).toUpperCase();
        return `
        <div class="request-card">
          <div class="request-header">
            <div class="friend-avatar">${initials}</div>
            <div class="friend-info">
              <p class="friend-name">${displayName}</p>
              <p class="friend-username">@${request.username}</p>
            </div>
          </div>
          <div class="friend-actions">
            <button class="accept-btn" data-friend-id="${request.id}">Accept</button>
            <button class="reject-btn" data-friend-id="${request.id}">Reject</button>
          </div>
        </div>
      `;
      }).join("");
      requestsList.querySelectorAll(".accept-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const friendId = target.dataset.friendId;
          if (friendId) this.acceptFriendRequest(friendId);
        });
      });
      requestsList.querySelectorAll(".reject-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const friendId = target.dataset.friendId;
          if (friendId) this.rejectFriendRequest(friendId);
        });
      });
    }
    renderInvitations() {
      const invitationsList = document.getElementById("invitationsList");
      if (!invitationsList) return;
      const invitationsCount = document.getElementById("invitationsCount");
      if (invitationsCount) {
        invitationsCount.textContent = this.invitations.length.toString();
        invitationsCount.style.display = this.invitations.length > 0 ? "inline-block" : "none";
      }
      if (this.invitations.length === 0) {
        invitationsList.innerHTML = '<div class="empty-state"><p>No pending room invitations</p></div>';
        return;
      }
      invitationsList.innerHTML = this.invitations.map((invitation) => {
        const displayName = invitation.sender_first_name || invitation.sender_username;
        const initials = displayName.substring(0, 2).toUpperCase();
        const expiresAt = new Date(invitation.expires_at);
        const timeLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 6e4));
        return `
        <div class="invitation-card">
          <div class="invitation-header">
            <div class="friend-avatar">${initials}</div>
            <div class="friend-info">
              <p class="friend-name">${displayName}</p>
              <p class="friend-username">@${invitation.sender_username}</p>
            </div>
          </div>
          <div class="invitation-details">
            <div class="invitation-room">
              <span class="label">Room:</span>
              <span class="value">${invitation.room_id}</span>
            </div>
            <div class="invitation-pin">
              <span class="label">PIN:</span>
              <span class="pin-code">${invitation.pin}</span>
            </div>
            <div class="invitation-expires">Expires in ${timeLeft} minutes</div>
          </div>
          <div class="friend-actions">
            <button class="join-room-btn" data-invitation-id="${invitation.id}" data-room-id="${invitation.room_id}" data-pin="${invitation.pin}">
              Join Room
            </button>
            <button class="reject-btn" data-invitation-id="${invitation.id}">
              Decline
            </button>
          </div>
        </div>
      `;
      }).join("");
      invitationsList.querySelectorAll(".join-room-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const invitationId = target.dataset.invitationId;
          const roomId = target.dataset.roomId;
          const pin = target.dataset.pin;
          if (invitationId && roomId && pin) {
            this.acceptRoomInvitation(invitationId, roomId, pin);
          }
        });
      });
      invitationsList.querySelectorAll(".reject-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const invitationId = target.dataset.invitationId;
          if (invitationId) this.rejectRoomInvitation(invitationId);
        });
      });
    }
    async searchUsers() {
      const input = document.getElementById("searchUserInput");
      if (!input || !input.value.trim()) return;
      try {
        const data = await this.apiCall(`/users/search?q=${encodeURIComponent(input.value.trim())}`);
        this.renderSearchResults(data.users);
      } catch (err) {
        console.error("Failed to search users:", err);
        alert("Failed to search users");
      }
    }
    renderSearchResults(users) {
      const searchResults = document.getElementById("searchResults");
      if (!searchResults) return;
      if (users.length === 0) {
        searchResults.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
        return;
      }
      searchResults.innerHTML = users.map((user) => {
        const displayName = user.first_name || user.username;
        const initials = displayName.substring(0, 2).toUpperCase();
        return `
        <div class="user-search-card">
          <div class="friend-avatar">${initials}</div>
          <div class="friend-info">
            <p class="friend-name">${displayName}</p>
            <p class="friend-username">@${user.username}</p>
          </div>
          <button class="send-request-btn" data-user-id="${user.id}">Add Friend</button>
        </div>
      `;
      }).join("");
      searchResults.querySelectorAll(".send-request-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const userId = target.dataset.userId;
          if (userId) this.sendFriendRequest(userId);
        });
      });
    }
    async sendFriendRequest(friendId) {
      try {
        await this.apiCall("/friends/request", "POST", { friendId });
        if (this.socket) {
          this.socket.emit("send_friend_request", { friendId });
        }
        this.showNotification("Friend request sent!");
        const modal = document.getElementById("addFriendModal");
        if (modal) modal.style.display = "none";
        const input = document.getElementById("searchUserInput");
        if (input) input.value = "";
        const searchResults = document.getElementById("searchResults");
        if (searchResults) {
          searchResults.innerHTML = '<div class="empty-state"><p>Search for users to add as friends</p></div>';
        }
      } catch (err) {
        console.error("Failed to send friend request:", err);
        alert(err.message || "Failed to send friend request");
      }
    }
    async acceptFriendRequest(friendId) {
      try {
        await this.apiCall("/friends/accept", "POST", { friendId });
        if (this.socket) {
          this.socket.emit("accept_friend_request", { friendId });
        }
        this.loadFriends();
        this.loadFriendRequests();
        this.showNotification("Friend request accepted!");
      } catch (err) {
        console.error("Failed to accept friend request:", err);
        alert(err.message || "Failed to accept friend request");
      }
    }
    async rejectFriendRequest(friendId) {
      try {
        await this.apiCall("/friends/reject", "POST", { friendId });
        this.loadFriendRequests();
        this.showNotification("Friend request rejected");
      } catch (err) {
        console.error("Failed to reject friend request:", err);
        alert(err.message || "Failed to reject friend request");
      }
    }
    async removeFriend(friendId) {
      try {
        await this.apiCall(`/friends/${friendId}`, "DELETE");
        this.loadFriends();
        this.showNotification("Friend removed");
      } catch (err) {
        console.error("Failed to remove friend:", err);
        alert(err.message || "Failed to remove friend");
      }
    }
    async inviteToRoom(friendId) {
      if (!this.currentRoomId) {
        alert("No active room");
        return;
      }
      const roomPin = this.currentRoomPin || "0000";
      try {
        await this.apiCall("/invitations/rooms", "POST", {
          friendId,
          roomId: this.currentRoomId,
          pin: roomPin
        });
        if (this.socket) {
          this.socket.emit("send_room_invitation", {
            friendId,
            roomId: this.currentRoomId,
            pin: roomPin
          });
        }
        this.showNotification("Room invitation sent!");
      } catch (err) {
        console.error("Failed to send room invitation:", err);
        alert(err.message || "Failed to send room invitation");
      }
    }
    async acceptRoomInvitation(invitationId, roomId, pin) {
      try {
        await this.apiCall(`/invitations/rooms/${invitationId}/accept`, "POST");
        this.loadRoomInvitations();
        window.location.href = `/room.html?roomId=${roomId}&pin=${pin}`;
      } catch (err) {
        console.error("Failed to accept room invitation:", err);
        alert(err.message || "Failed to accept room invitation");
      }
    }
    async rejectRoomInvitation(invitationId) {
      try {
        await this.apiCall(`/invitations/rooms/${invitationId}/reject`, "POST");
        this.loadRoomInvitations();
        this.showNotification("Room invitation declined");
      } catch (err) {
        console.error("Failed to reject room invitation:", err);
        alert(err.message || "Failed to reject room invitation");
      }
    }
    updateNotificationBadge() {
      const badge = document.getElementById("friendsNotificationBadge");
      if (!badge) return;
      const totalNotifications = this.requests.length + this.invitations.length;
      if (totalNotifications > 0) {
        badge.textContent = totalNotifications.toString();
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
    updateOnlineStatus() {
      this.friends.forEach((friend) => {
        friend.isOnline = this.onlineUsers.has(friend.id);
      });
      this.renderFriends();
    }
    updateInviteButtons() {
      const buttons = document.querySelectorAll(".invite-room-btn");
      buttons.forEach((btn) => {
        btn.disabled = !this.currentRoomId;
      });
    }
    showNotification(message) {
      console.log("Notification:", message);
      const notification = document.createElement("div");
      notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(26, 115, 232, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: slideInRight 0.3s ease;
    `;
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.animation = "slideOutRight 0.3s ease";
        setTimeout(() => notification.remove(), 300);
      }, 3e3);
    }
  };

  return FriendsManager;
})();
