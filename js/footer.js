export function initFooter() {
  document.querySelectorAll(".footer-link-button").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(
        "https://jobs.fifa.com/themes/3491/privacy_policy",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });
}
