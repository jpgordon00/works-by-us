const toggle = document.getElementById('work-toggle');
const options = document.getElementById('work-on-this');

function showOptions(open) {
  options.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

showOptions(location.hash === '#work-on-this');
toggle.hidden = false;
toggle.addEventListener('click', () => showOptions(options.hidden));
window.addEventListener('hashchange', () => {
  if (location.hash === '#work-on-this') {
    showOptions(true);
    options.scrollIntoView();
  }
});

// iPadOS can identify as macOS when Safari requests the desktop site.
const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1);
const desktop = /Macintosh|Windows NT|X11; Linux/i.test(navigator.userAgent);
if (desktop && !mobile) {
  for (const link of options.querySelectorAll('[data-desktop-href]')) {
    link.href = link.dataset.desktopHref;
    link.nextElementSibling.hidden = false;
  }
}
