import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from "@tanstack/vue-query";
import { initDB } from './utils/localDB'; // Import initDB

const app = createApp(App)

app.use(createPinia())
app.use(VueQueryPlugin)

// Initialize the local database
initDB().then(() => {
  console.log("Local DB initialized successfully from main.js.");
}).catch(error => {
  console.error("Failed to initialize local DB from main.js:", error);
  // Optionally, you could inform the user or try fallback mechanisms here
});

app.mount('#app')
