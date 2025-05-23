import { defineStore } from 'pinia';
import { loginToERPNext, getFrappeCsrfToken } from '../services/api';

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
        
        // Attempt to fetch and store CSRF token immediately after login
        try {
            console.log('Attempting to fetch CSRF token post-login...');
            const token = await getFrappeCsrfToken(erpNextUrl); // Await the token fetch
            if (token && !token.startsWith('dummy_')) { 
                this.setCurrentUserCSRFToken(token); // This is synchronous and updates this.currentUser
                console.log('CSRF token set in currentUser during login:', this.currentUser.csrf_token);
            } else {
                console.warn("Received a dummy or invalid CSRF token post-login, not storing it in currentUser.");
                // Ensure csrf_token is explicitly undefined or null if not successfully fetched
                if (this.currentUser) this.currentUser.csrf_token = null;
            }
        } catch (csrfError) {
            console.warn("Failed to fetch/set CSRF token immediately after login:", csrfError.message);
            if (this.currentUser) this.currentUser.csrf_token = null; // Ensure it's null on error
        }
        
        console.log('Login successful, currentUser state:', JSON.stringify(this.currentUser));
        return this.currentUser; // Return the fully updated currentUser object
      } catch (error) {
        console.error('Login action error:', error);
        this.logout(); // Reset auth state on login failure
        this.loginError = error.message || 'An unexpected error occurred during login.';
        throw error; // Re-throw for useMutation's onError to catch
      }
    },
    logout() {
      this.currentUser = null;
      this.isLoggedIn = false;
      this.loginPOSProfileName = null;
      this.loginError = null;
      console.log('User logged out, CSRF token (if any) cleared.');
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
        // console.log("CSRF token set in authStore's currentUser:", token);
      } else {
        // console.warn("Cannot set CSRF token: currentUser is null.");
      }
    },
    clearCurrentUserCSRFToken() {
      if (this.currentUser) {
        this.currentUser.csrf_token = null;
        // console.log("CSRF token cleared from authStore's currentUser.");
      }
    }
  },
});
