document.addEventListener('DOMContentLoaded', () => {
  const d = document.createElement('div');
  d.textContent = 'SUCCESS — script.js injection worked';
  Object.assign(d.style, {
    position: 'fixed',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 16px',
    background: '#0a0',
    color: '#fff',
    zIndex: 999999,
    borderRadius: '8px',
    fontFamily: 'sans-serif',
    fontSize: '16px'
  });
  document.body.prepend(d);
});
