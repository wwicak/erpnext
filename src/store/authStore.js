import { defineStore } from 'pinia';
import { loginToERPNext, getFrappeCsrfToken } from '../services/api';
import { logClerkActivity } from '../utils/localDB'; // Import activity logger

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: null, // { user_id, full_name, csrf_token (if obtained) }
    isLoggedIn: false,
    loginPOSProfileName: null, // The POS profile name entered by the user during login
    loginError: null,
  }),
  getters: {
    isAuthenticated: (state) => state.isLoggedIn,
    userName: (state) => (state.currentUser ? state.currentUser.full_name : null),
    csrfToken: (state) => (state.currentUser ? state.currentUser.csrf_token : null), 
  },
  actions: {
    async login(erpNextUrl, username, password, posProfileNameFromUI) {
      this.clearLoginError();
      try {
        const userData = await loginToERPNext(erpNextUrl, username, password);
        
        this.currentUser = { 
          user_id: userData.user_id, 
          full_name: userData.full_name,
          // csrf_token will be set below
        };
        this.isLoggedIn = true;
        this.loginPOSProfileName = posProfileNameFromUI;
        
        // Log clerk login activity
        try {
          await logClerkActivity(this.currentUser.user_id, this.currentUser.full_name, 'CLERK_LOGIN', { posProfile: posProfileNameFromUI });
        } catch (logError) {
          console.error("Failed to log clerk login activity:", logError);
        }

        // Attempt to fetch and store CSRF token immediately after login
        try {
            // console.log('Attempting to fetch CSRF token post-login...');
            const token = await getFrappeCsrfToken(erpNextUrl); 
            if (token && !token.startsWith('dummy_')) { 
                this.setCurrentUserCSRFToken(token); 
                // console.log('CSRF token set in currentUser during login:', this.currentUser.csrf_token);
            } else {
                // console.warn("Received a dummy or invalid CSRF token post-login, not storing it in currentUser.");
                if (this.currentUser) this.currentUser.csrf_token = null;
            }
        } catch (csrfError) {
            console.warn("Failed to fetch/set CSRF token immediately after login:", csrfError.message);
            if (this.currentUser) this.currentUser.csrf_token = null; 
        }
        
        // console.log('Login successful, currentUser state:', JSON.stringify(this.currentUser));
        return this.currentUser; 
      } catch (error) {
        console.error('Login action error:', error);
        // Log failed login attempt before logging out state
        try {
          await logClerkActivity(username, 'N/A', 'CLERK_LOGIN_FAILED', { error: error.message, posProfileAttempt: posProfileNameFromUI });
        } catch (logError) {
          console.error("Failed to log clerk failed login activity:", logError);
        }
        this.logout(); // Reset auth state on login failure
        this.loginError = error.message || 'An unexpected error occurred during login.';
        throw error; 
      }
    },
    async logout() { // Made async for logging
      if (this.currentUser && this.isLoggedIn) {
        try {
          await logClerkActivity(this.currentUser.user_id, this.currentUser.full_name, 'CLERK_LOGOUT');
        } catch (logError) {
          console.error("Failed to log clerk logout activity:", logError);
        }
      }
      this.currentUser = null;
      this.isLoggedIn = false;
      this.loginPOSProfileName = null;
      this.loginError = null;
      // console.log('User logged out, CSRF token (if any) cleared.');
    },
    setLoginError(errorMessage) {
      this.loginError = errorMessage;
    },
    clearLoginError() {
      this.loginError = null;
    },
    _setLoggedInState(user, posProfileName) {
        this.currentUser = user; 
        this.isLoggedIn = true;
        this.loginPOSProfileName = posProfileName;
        this.loginError = null;
    },
    setCurrentUserCSRFToken(token) {
      if (this.currentUser) {
        this.currentUser.csrf_token = token;
      }
    },
    clearCurrentUserCSRFToken() {
      if (this.currentUser) {
        this.currentUser.csrf_token = null;
      }
    }
  },
});
