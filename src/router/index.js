import { createRouter, createWebHistory } from 'vue-router';

// Clerk POS Components
import ClerkLoginScreen from '../components/LoginScreen.vue';
import POSInterface from '../components/POSInterface.vue';

// Admin Panel Components
import AdminLogin from '../components/admin/AdminLogin.vue';
import AdminLayout from '../components/admin/AdminLayout.vue';
import AdminDashboard from '../components/admin/AdminDashboard.vue';
import ChangeAdminPassword from '../components/admin/ChangeAdminPassword.vue';
import AdminERPConfig from '../components/admin/AdminERPConfig.vue';
import AdminBarcodeSettings from '../components/admin/AdminBarcodeSettings.vue';
import AdminPrinterSettings from '../components/admin/AdminPrinterSettings.vue';
import AdminPrinterSettings from '../components/admin/AdminPrinterSettings.vue';
import AdminDailySales from '../components/admin/AdminDailySales.vue';
import AdminAPILog from '../components/admin/AdminAPILog.vue';
import AdminSettings from '../components/admin/AdminSettings.vue'; // Import App Settings component

// Store imports for route guards
import { useAuthStore } from '../store/authStore'; // Clerk auth
import { useAdminAuthStore } from '../store/adminAuthStore'; // Admin auth


const routes = [
  // Clerk POS Routes
  {
    path: '/',
    name: 'ClerkLogin',
    component: ClerkLoginScreen,
    meta: { requiresClerkGuest: true } // Redirect if clerk is already logged in
  },
  {
    path: '/pos',
    name: 'POSInterface',
    component: POSInterface,
    meta: { requiresClerkAuth: true } 
  },

  // Admin Panel Routes
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: AdminLogin,
    meta: { requiresAdminGuest: true } // Redirect if admin is already logged in
  },
  {
    path: '/admin',
    component: AdminLayout, 
    meta: { requiresAdminAuth: true }, 
    children: [
      {
        path: '', 
        name: 'AdminBase', // Added a name for direct navigation if needed
        redirect: '/admin/dashboard', 
      },
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: AdminDashboard,
      },
      {
        path: 'change-password',
        name: 'ChangeAdminPassword',
        component: ChangeAdminPassword,
        // Specific guard for this route is handled in beforeEach
      },
      {
        path: 'erp-config', // New route
        name: 'AdminERPConfig',
        component: AdminERPConfig,
      },
      {
        path: 'barcode-settings', // New route for barcode settings
        name: 'AdminBarcodeSettings',
        component: AdminBarcodeSettings,
      },
      {
        path: 'printer-settings', // New route for printer settings
        name: 'AdminPrinterSettings',
        component: AdminPrinterSettings,
      },
      {
        path: 'activity-log', // New route for activity log
        name: 'AdminActivityLog',
        component: AdminActivityLog,
      },
      {
        path: 'app-settings', // New route for app settings
        name: 'AdminAppSettings',
        component: AdminSettings,
      },
    ],
  },
  // Example: Catch-all for 404 - Can be added later if a specific 404 page is designed
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/NotFound.vue') },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), 
  routes,
});

// Navigation Guards
router.beforeEach((to, from, next) => {
  // IMPORTANT: Pinia stores must be instantiated *inside* the guard
  // because the guard runs outside of component setup context initially.
  const authStore = useAuthStore(); 
  const adminAuthStore = useAdminAuthStore(); 

  // Clerk Auth
  if (to.meta.requiresClerkAuth && !authStore.isAuthenticated) {
    console.log('Router Guard: Clerk auth required, not authenticated. Redirecting to ClerkLogin.');
    next({ name: 'ClerkLogin', query: { redirect: to.fullPath } });
  } else if (to.meta.requiresClerkGuest && authStore.isAuthenticated) {
    console.log('Router Guard: Clerk guest required, already authenticated. Redirecting to POSInterface.');
    next({ name: 'POSInterface' });
  }
  // Admin Auth
  else if (to.meta.requiresAdminAuth && !adminAuthStore.isAdminAuthenticated) {
    console.log('Router Guard: Admin auth required, not authenticated. Redirecting to AdminLogin.');
    next({ name: 'AdminLogin', query: { redirect: to.fullPath } });
  } else if (to.meta.requiresAdminGuest && adminAuthStore.isAdminAuthenticated) {
    console.log('Router Guard: Admin guest required, already authenticated. Redirecting to AdminDashboard.');
    next({ name: 'AdminDashboard' });
  }
  // Specific logic for /admin/change-password
  else if (to.name === 'ChangeAdminPassword') {
    if (!adminAuthStore.isAdminAuthenticated) { // Must be logged in to change password
      console.log('Router Guard: Admin not authenticated. Redirecting to AdminLogin from ChangeAdminPassword.');
      next({ name: 'AdminLogin' });
    } else if (adminAuthStore.hasAdminPasswordBeenChanged()) {
      // If password has been changed, and user tries to access change-password directly,
      // redirect them to dashboard. They can change it again via a settings link later if needed.
      // This primarily handles the forced change scenario.
      console.log('Router Guard: Admin password already changed. Redirecting to AdminDashboard from ChangeAdminPassword.');
      next({ name: 'AdminDashboard' });
    } else {
      next(); // Allow access if logged in and password not yet changed
    }
  }
  // Specific logic for /admin routes if password has NOT been changed
  else if (to.matched.some(record => record.path.startsWith('/admin')) && // Any route under /admin
             to.name !== 'AdminLogin' && // except login itself
             to.name !== 'ChangeAdminPassword' && // and except change-password
             adminAuthStore.isAdminAuthenticated && // and admin is logged in
             !adminAuthStore.hasAdminPasswordBeenChanged()) // BUT password has not been changed
  {
    console.log('Router Guard: Admin password not changed. Forcing redirect to ChangeAdminPassword.');
    next({ name: 'ChangeAdminPassword' }); // Force password change
  }
  else {
    next(); // No specific rules matched, proceed
  }
});

export default router;
