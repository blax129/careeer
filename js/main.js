import "./hero-video.js";
import { initFooter } from "./footer.js";

function initNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  const menu = document.querySelector(".nav-menu");

  toggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.classList.toggle("is-active", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  menu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle?.classList.remove("is-active");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });
}

initNavigation();
initFooter();
