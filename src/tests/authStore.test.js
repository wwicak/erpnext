import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import * as api from '../services/api'; // To mock its functions

// Mock the entire api module
vi.mock('../services/api', () => ({
  loginToERPNext: vi.fn(),
  getFrappeCsrfToken: vi.fn(),
}));

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Reset mocks before each test
    vi.resetAllMocks();
    // Reset store state
    const authStore = useAuthStore();
    authStore.$reset(); // Assumes $reset is enabled or defined
    // authStore.currentUser = null;
    // authStore.isLoggedIn = false;
    // authStore.loginPOSProfileName = null;
    // authStore.loginError = null;
  });

  const mockErpNextUrl = 'http://test-erp.com';
  const mockUsername = 'testuser';
  const mockPassword = 'password';
  const mockPosProfile = 'Test Profile';

  it('handles successful login', async () => {
    const authStore = useAuthStore();
    const mockUserData = { user_id: 'testuser', full_name: 'Test User' };
    const mockCsrfToken = 'test-csrf-token';

    api.loginToERPNext.mockResolvedValue(mockUserData);
    api.getFrappeCsrfToken.mockResolvedValue(mockCsrfToken);

    await authStore.login(mockErpNextUrl, mockUsername, mockPassword, mockPosProfile);

    expect(authStore.isLoggedIn).toBe(true);
    expect(authStore.currentUser).toEqual({ ...mockUserData, csrf_token: mockCsrfToken });
    expect(authStore.loginPOSProfileName).toBe(mockPosProfile);
    expect(authStore.loginError).toBeNull();
    expect(api.loginToERPNext).toHaveBeenCalledWith(mockErpNextUrl, mockUsername, mockPassword);
    expect(api.getFrappeCsrfToken).toHaveBeenCalledWith(mockErpNextUrl);
  });

  it('handles successful login even if CSRF token fetch fails', async () => {
    const authStore = useAuthStore();
    const mockUserData = { user_id: 'testuser', full_name: 'Test User' };
    
    api.loginToERPNext.mockResolvedValue(mockUserData);
    api.getFrappeCsrfToken.mockRejectedValue(new Error('CSRF fetch failed')); // Simulate CSRF fetch failure

    await authStore.login(mockErpNextUrl, mockUsername, mockPassword, mockPosProfile);

    expect(authStore.isLoggedIn).toBe(true);
    expect(authStore.currentUser).toEqual({ ...mockUserData, csrf_token: null }); // Expect null as per updated store logic
    expect(authStore.loginPOSProfileName).toBe(mockPosProfile);
    expect(authStore.loginError).toBeNull();
  });
  
  it('handles login failure from API', async () => {
    const authStore = useAuthStore();
    const loginError = new Error('Invalid credentials');
    api.loginToERPNext.mockRejectedValue(loginError);

    try {
      await authStore.login(mockErpNextUrl, mockUsername, mockPassword, mockPosProfile);
    } catch (e) {
      expect(e).toBe(loginError);
    }

    expect(authStore.isLoggedIn).toBe(false);
    expect(authStore.currentUser).toBeNull();
    expect(authStore.loginPOSProfileName).toBeNull();
    expect(authStore.loginError).toBe('Invalid credentials');
    expect(api.getFrappeCsrfToken).not.toHaveBeenCalled(); // Should not be called if login fails
  });

  it('handles logout', () => {
    const authStore = useAuthStore();
    // Simulate a logged-in state
    authStore.currentUser = { user_id: 'testuser', full_name: 'Test User', csrf_token: 'abc' };
    authStore.isLoggedIn = true;
    authStore.loginPOSProfileName = 'Test Profile';

    authStore.logout();

    expect(authStore.isLoggedIn).toBe(false);
    expect(authStore.currentUser).toBeNull();
    expect(authStore.loginPOSProfileName).toBeNull();
    expect(authStore.loginError).toBeNull();
  });

  it('sets and clears CSRF token', () => {
    const authStore = useAuthStore();
    authStore.currentUser = { user_id: 'testuser', full_name: 'Test User' }; // Need currentUser to exist

    const token = 'new-csrf-token';
    authStore.setCurrentUserCSRFToken(token);
    expect(authStore.currentUser.csrf_token).toBe(token);
    expect(authStore.csrfToken).toBe(token);

    authStore.clearCurrentUserCSRFToken();
    expect(authStore.currentUser.csrf_token).toBeNull();
    expect(authStore.csrfToken).toBeNull();
  });

   it('does not set CSRF token if currentUser is null', () => {
    const authStore = useAuthStore();
    authStore.currentUser = null; // Ensure currentUser is null

    const token = 'new-csrf-token';
    authStore.setCurrentUserCSRFToken(token);
    expect(authStore.currentUser).toBeNull(); // Still null
    expect(authStore.csrfToken).toBeNull(); // Getter should return null
  });
});
