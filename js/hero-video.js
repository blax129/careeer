function initHeroVideo() {
  const video = document.querySelector(".hero-video");
  if (!video) return;

  video.muted = true;

  const play = () => {
    video.play().catch(() => {
      // Autoplay can still be blocked until user interaction in some browsers.
    });
  };

  if (video.readyState >= 2) {
    play();
  } else {
    video.addEventListener("loadeddata", play, { once: true });
  }
}

initHeroVideo();
