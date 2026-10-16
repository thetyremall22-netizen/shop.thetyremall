import Script from "next/script";
import {
  ANALYTICS_ENABLED,
  CONSENT_DENIED_REGIONS,
  DEVELOPER_ID,
  GTAG_IDS,
  GTM_ID,
  PRIMARY_GTAG_ID,
} from "@/lib/analytics";

// Mirrors the Google Site Kit stack on the live site: Consent Mode v2 (default
// denied in the EU/EEA/UK, granted elsewhere), the primary Google tag (gtag.js)
// which drives GA4 + Google Ads + the GT- tags, and Google Tag Manager.
//
// The consent default + dataLayer bootstrap is an inline `beforeInteractive`
// script so it is the *first* gtag command, before gtag.js or GTM load — a hard
// requirement for Consent Mode. It also re-applies the visitor's saved choice
// (localStorage `ttm-consent`) immediately so a returning visitor's tags fire at
// the right consent state without waiting for the banner to mount.
const bootstrap = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',
  analytics_storage:'denied',functionality_storage:'denied',
  personalization_storage:'denied',security_storage:'denied',
  region:${JSON.stringify(CONSENT_DENIED_REGIONS)},wait_for_update:500
});
try{
  var c=localStorage.getItem('ttm-consent');
  if(c){
    var g=JSON.parse(c)==='granted';
    var v=g?'granted':'denied';
    gtag('consent','update',{
      ad_storage:v,ad_user_data:v,ad_personalization:v,analytics_storage:v,
      functionality_storage:v,personalization_storage:v,security_storage:v
    });
  }
}catch(e){}
gtag('set','developer_id.${DEVELOPER_ID}',true);
gtag('js',new Date());
${GTAG_IDS.map((id) => `gtag('config','${id}');`).join("\n")}
`.trim();

const gtmLoader = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
`.trim();

export function GoogleTracking() {
  if (!ANALYTICS_ENABLED) return null;
  return (
    <>
      {/* 1. Consent Mode default + dataLayer — must run before any tag loads */}
      <Script id="ttm-consent-default" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: bootstrap }} />
      {/* 2. Primary Google tag (loads gtag.js; drives GA4, Ads, GT- tags) */}
      <Script id="ttm-gtag-src" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${PRIMARY_GTAG_ID}`} />
      {/* 3. Google Tag Manager */}
      <Script id="ttm-gtm" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: gtmLoader }} />
    </>
  );
}

// Body <noscript> fallback for GTM. Rendered right after <body> opens.
export function GoogleTagManagerNoScript() {
  if (!ANALYTICS_ENABLED) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
