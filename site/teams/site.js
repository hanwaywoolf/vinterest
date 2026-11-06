// Shared by every page: the Test Your List form (the reading behind it comes later).
const file = document.getElementById('file'), drop = document.getElementById('drop');
file.addEventListener('change', () => { if (file.files[0]) { drop.classList.add('has'); document.getElementById('dropText').textContent = file.files[0].name; drop.querySelector('b').textContent = 'Ready to read'; } });
document.getElementById('testForm').addEventListener('submit', (e) => { e.preventDefault(); document.getElementById('formNote').textContent = 'This is the mockup: the reading is wired up when the site is built. Your file never left your device.'; });
