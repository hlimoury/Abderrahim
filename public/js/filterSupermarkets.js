/*  filterSupermarkets.js
    ----------------------
    Affiche / masque dynamiquement les lignes du tableau des magasins
    en fonction de ce que l’utilisateur tape dans le champ “Nom du
    magasin”.  Aucune requête Ajax : tout est filtré côté client. */

    document.addEventListener('DOMContentLoaded', () => {

        const inputNom   = document.querySelector('input[name="nom"]');
        if (!inputNom) return;                           // page sans champ
      
        const marketRows   = document.querySelectorAll('tr.market-row');
      
        /*  Quand on tape dans le champ */
        inputNom.addEventListener('input', () => {
          const q = inputNom.value.trim().toLowerCase();
      
          marketRows.forEach(row => {
            const haystack = row.dataset.search || '';
            const match = !q || haystack.includes(q);
      
            /* Ligne principale */
            row.style.display = match ? '' : 'none';
      
            /* Ligne “collapse” associée (tableau des instances) */
            const targetId = row.dataset.bsTarget;
            if (targetId) {
              const collapseRow = document.querySelector(targetId);
              if (collapseRow) collapseRow.style.display = match ? '' : 'none';
            }
          });
        });
      });
      