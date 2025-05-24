import { ref, computed, onUnmounted } from 'vue';

/**
 * Composable for managing an idle timer.
 * @param {import('vue').Ref<number>} timeoutInMinutesRef - Reactive ref holding the timeout duration in minutes.
 * @param {Function} onIdleCallback - Callback function to execute when the timer expires.
 */
export function useIdleTimer(timeoutInMinutesRef, onIdleCallback) {
  const timeoutMilliseconds = computed(() => {
    const minutes = Number(timeoutInMinutesRef.value);
    if (isNaN(minutes) || minutes <= 0) {
      return 0; // Timer disabled
    }
    return minutes * 60 * 1000;
  });

  const idleTimer = ref(null);
  const eventsToWatch = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'visibilitychange'];

  const resetTimer = () => {
    if (idleTimer.value) {
      clearTimeout(idleTimer.value);
      idleTimer.value = null;
    }

    if (timeoutMilliseconds.value > 0) { // Only set timer if timeout is positive
      idleTimer.value = setTimeout(() => {
        console.log(`Idle timer expired after ${timeoutInMinutesRef.value} minutes.`);
        onIdleCallback();
      }, timeoutMilliseconds.value);
      // console.log(`Idle timer reset for ${timeoutInMinutesRef.value} minutes.`);
    } else {
      // console.log("Idle timer disabled (timeout is 0 or less).");
    }
  };

  const handleActivity = () => {
    // console.log('Activity detected, resetting idle timer.');
    resetTimer();
  };
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Optional: Could pause timer or take other action when tab is hidden
      // console.log('Tab hidden, idle timer behavior might change based on policy.');
    } else {
      // When tab becomes visible again, treat it as activity
      // console.log('Tab visible, resetting idle timer.');
      handleActivity();
    }
  };


  const start = () => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      eventsToWatch.forEach(event => {
        if (event === 'visibilitychange') {
          document.addEventListener(event, handleVisibilityChange);
        } else {
          window.addEventListener(event, handleActivity, true); // Use capture for some events if needed
        }
      });
      resetTimer(); // Initial timer start
      console.log("Idle timer started.");
    } else {
      console.warn("useIdleTimer: Cannot start, window or document not available (SSR context?).");
    }
  };

  const stop = () => {
     if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      eventsToWatch.forEach(event => {
         if (event === 'visibilitychange') {
          document.removeEventListener(event, handleVisibilityChange);
        } else {
          window.removeEventListener(event, handleActivity, true);
        }
      });
      if (idleTimer.value) {
        clearTimeout(idleTimer.value);
        idleTimer.value = null;
      }
      console.log("Idle timer stopped.");
    }
  };
  
  // Clean up listeners when the component using the composable is unmounted
  // This is a good practice if the start/stop are not explicitly managed by the component's lifecycle.
  // However, for this specific task, POSInterface will manage start/stop in its onMounted/onUnmounted.
  // So, this onUnmounted might be redundant if POSInterface always calls stop().
  // But it's a good safeguard.
  // onUnmounted(() => {
  //   stop();
  // });

  return {
    start,
    stop,
    resetTimer // Expose resetTimer if manual reset from component is desired
  };
}
