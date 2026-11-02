"use client";

import { useEffect } from "react";

/** Admin pages aren't run through the www → thetyremall.co.za forward in
 *  src/proxy.ts, so send them across here, keeping the page. (Sign-ins are per
 *  address: someone signed in on www signs in once more on the main address.) */
export function WwwToMainAddress() {
  useEffect(() => {
    if (window.location.hostname === "www.thetyremall.co.za") {
      window.location.replace(`https://thetyremall.co.za${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, []);
  return null;
}
