import { defineStore } from 'pinia';
import router from '../router'; // Import router for navigation

export const useAdminAuthStore = defineStore('adminAuth', {
  state: () => ({
    isAdminLoggedIn: localStorage.getItem('isAdminLoggedIn') === 'true' || false,
    adminUser: JSON.parse(localStorage.getItem('adminUser')) || null,
    // For simplicity in this local-only app, we'll store the "current" password here.
    // In a real app, this would NEVER be done. Password would be hashed and stored securely on a backend.
    // The initial password is 'passwordChange123'. After change, this state reflects the new password.
    currentAdminPassword: localStorage.getItem('currentAdminPassword') || 'passwordChange123',
  }),
  getters: {
    isAdminAuthenticated: (state) => state.isAdminLoggedIn,
  },
  actions: {
    loginAdmin(username, password) {
      // Hardcoded username 'admin'
      if (username === 'admin' && password === this.currentAdminPassword) {
        this.isAdminLoggedIn = true;
        this.adminUser = { username: 'admin', name: 'Administrator' }; // Store some user info
        localStorage.setItem('isAdminLoggedIn', 'true');
        localStorage.setItem('adminUser', JSON.stringify(this.adminUser));
        console.log('Admin login successful.');
        return true;
      } else {
        console.log('Admin login failed. Provided:', username, 'Expected pass:', this.currentAdminPassword);
        return false;
      }
    },
    logoutAdmin() {
      this.isAdminLoggedIn = false;
      this.adminUser = null;
      localStorage.removeItem('isAdminLoggedIn');
      localStorage.removeItem('adminUser');
      // Note: currentAdminPassword and isAdminPasswordChanged are intentionally not cleared on logout
      // to maintain the password state and changed status across sessions for this local app.
      // In a real app, session termination would happen on a backend.
      console.log('Admin logged out.');
      router.push({ name: 'AdminLogin' }); // Navigate to admin login after logout
    },
    changeAdminPassword(newPassword) {
      if (!this.isAdminLoggedIn) {
        console.error("Cannot change password: Admin not logged in.");
        return false; // Or throw error
      }
      this.currentAdminPassword = newPassword;
      localStorage.setItem('currentAdminPassword', newPassword);
      localStorage.setItem('isAdminPasswordChanged', 'true');
      console.log('Admin password changed successfully.');
      return true;
    },
    // Helper to check if password has been changed from default
    hasAdminPasswordBeenChanged() {
        return localStorage.getItem('isAdminPasswordChanged') === 'true';
    }
  },
});
