"use client";

import { useEffect } from "react";

export default function LocalOrigin() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && window.location.hostname === "localhost" && window.location.port === "3000") {
      window.location.replace(`http://127.0.0.1:3000${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, []);
  return null;
}
