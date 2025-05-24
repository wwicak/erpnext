import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from "@tanstack/vue-query";
import { initDB } from './utils/localDB';
import router from './router'; // Import the router

const app = createApp(App)

app.use(createPinia())
app.use(VueQueryPlugin)
app.use(router); // Use the router

// Initialize the local database
initDB().then(() => {
  console.log("Local DB initialized successfully from main.js.");
}).catch(error => {
  console.error("Failed to initialize local DB from main.js:", error);
});

app.mount('#app')
