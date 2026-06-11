function goBack(event, fallbackUrl) {
  event?.preventDefault();

  const referrer = document.referrer;

  if (referrer) {
    try {
      const cameFromSameSite =
        new URL(referrer).origin === window.location.origin;

      if (cameFromSameSite) {
        history.back();
        return;
      }
    } catch {
      // Ignore invalid referrer URLs.
    }
  }

  window.location.assign(fallbackUrl);
}

function initBackButton() {
  const fallbackUrl = document.body.dataset.backFallback || "./index.html";

  document.getElementById("back-button")?.addEventListener("click", (event) => {
    goBack(event, fallbackUrl);
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-back-link]");
    if (!link) return;
    goBack(event, fallbackUrl);
  });
}

initBackButton();
