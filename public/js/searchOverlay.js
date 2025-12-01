/*  searchOverlay.js – autocomplétion instantanée
    ----------------------------------------------------------
    ➜  Déposez-le (ou remplacez l’ancien) dans /public/js
    ➜  Nécessite la route GET /api/search (voir § 2)
*/

document.addEventListener('DOMContentLoaded', () => {

  /* éléments */
  const inputNom   = document.querySelector('input[name="nom"]');
  const inputVille = document.querySelector('input[name="ville"]');
  if (!inputNom) return;                   // page sans champ « nom »

  /* overlay container */
  const overlay = document.createElement('div');
  overlay.id = 'search-overlay';
  overlay.className = 'search-overlay shadow';
  overlay.style.display = 'none';
  inputNom.parentNode.style.position = 'relative';
  inputNom.parentNode.appendChild(overlay);

  let debounceTimer;
  let lastQuery = '';

  /* ───────────── listeners ───────────── */
  inputNom.addEventListener('focus', showOverlay);

  inputNom.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = inputNom.value.trim();
    lastQuery = q;
    if (!q) { clearResults(); return hideOverlay(); }
    debounceTimer = setTimeout(()=> fetchResults(q), 250);   // 250 ms debounce
  });

  document.addEventListener('click', e => {
    if (!overlay.contains(e.target) && e.target !== inputNom) hideOverlay();
  });

  /* ───────────── helpers ───────────── */
  function showOverlay()  { overlay.style.display = 'block'; }
  function hideOverlay()  { overlay.style.display = 'none'; }
  function clearResults() { overlay.innerHTML = ''; }

  function fetchResults(query) {
    fetch(`/api/search?query=${encodeURIComponent(query)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        if (query !== lastQuery) return;          // entrée déjà changée
        buildList(data);
      })
      .catch(err => {
        console.error(err);
        overlay.innerHTML = '<div class="p-2 text-danger">Erreur recherche</div>';
      });
  }

  function buildList(list) {
    clearResults();
    if (!list.length) {
      overlay.innerHTML = '<div class="p-2 text-muted">Aucun résultat</div>';
      return;
    }
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'result-item d-flex align-items-center p-2';
      div.style.cursor = 'pointer';

      /* icône ou image (facultatif) */
      const ico = document.createElement('i');
      ico.className = 'bi bi-shop me-2 text-primary';
      div.appendChild(ico);

      /* texte */
      const txt = document.createElement('span');
      txt.innerHTML = `<strong>${item.nom}</strong> — <small>${item.ville}</small>`;
      div.appendChild(txt);

      div.addEventListener('click', () => {
        inputNom.value   = item.nom;
        inputVille.value = item.ville;
        hideOverlay();
      });

      overlay.appendChild(div);
    });
    showOverlay();
  }
});
