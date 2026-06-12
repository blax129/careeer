import { SUPPORT_EMAIL } from "./site-config.js";

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

  injectSupportContact();
}

function injectSupportContact() {
  const footerBottom = document.querySelector(".footer-bottom");
  if (!footerBottom || footerBottom.querySelector(".footer-support")) {
    return;
  }

  const support = document.createElement("p");
  support.className = "footer-support";
  support.innerHTML = `Applicant support: <a class="footer-support__link" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;
  footerBottom.insertBefore(support, footerBottom.firstChild);
}
