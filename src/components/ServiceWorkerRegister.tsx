
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log(
          "Heloraa service worker registered:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error(
          "Heloraa service worker registration failed:",
          error
        );
      });
  }, []);

  return null;
}
