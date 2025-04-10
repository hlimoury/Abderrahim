// Add this to a new file called searchOverlay.js

document.addEventListener('DOMContentLoaded', function() {
    // Get search elements
    const searchInput = document.querySelector('input[name="nom"]');
    const searchOverlay = createSearchOverlay();
    let searchTimeout;
    let currentResults = [];
    
    // Add event listeners to search input
    searchInput.addEventListener('focus', function() {
      showSearchOverlay();
    });
    
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      const query = this.value.trim();
      
      // Only search if there's something to search for
      if (query.length > 1) {
        searchTimeout = setTimeout(() => performSearch(query), 300);
      } else {
        clearSearchResults();
      }
    });
    
    // Close overlay when clicking outside
    document.addEventListener('click', function(e) {
      if (!searchOverlay.contains(e.target) && e.target !== searchInput) {
        hideSearchOverlay();
      }
    });
    
    function createSearchOverlay() {
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'search-overlay';
      overlay.className = 'search-overlay';
      overlay.style.display = 'none';
      
      // Add to DOM
      searchInput.parentNode.style.position = 'relative';
      searchInput.parentNode.appendChild(overlay);
      
      return overlay;
    }
    
    function showSearchOverlay() {
      searchOverlay.style.display = 'block';
      
      // Position the overlay correctly
      const inputRect = searchInput.getBoundingClientRect();
      searchOverlay.style.width = '100%';
      
      // If we have previous results, show them immediately
      if (currentResults.length > 0) {
        updateSearchResults(currentResults);
      }
    }
    
    function hideSearchOverlay() {
      searchOverlay.style.display = 'none';
    }
    
    function clearSearchResults() {
      searchOverlay.innerHTML = '';
      currentResults = [];
    }
    
    function performSearch(query) {
      // Make AJAX request to search endpoint
      fetch(`/api/search?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
          currentResults = data;
          updateSearchResults(data);
        })
        .catch(error => {
          console.error('Search error:', error);
          searchOverlay.innerHTML = '<div class="search-error">Error searching</div>';
        });
    }
    
    function updateSearchResults(results) {
      clearSearchResults();
      
      if (results.length === 0) {
        searchOverlay.innerHTML = '<div class="no-results">No results found</div>';
        return;
      }
      
      results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        
        // Add an image if available (using placeholders since we don't have actual images)
        if (result.image) {
          const imgContainer = document.createElement('div');
          imgContainer.className = 'result-image';
          imgContainer.innerHTML = `<img src="${result.image}" alt="${result.nom}">`;
          resultItem.appendChild(imgContainer);
        }
        
        // Add title and subtitle
        const titleContainer = document.createElement('div');
        titleContainer.className = 'result-info';
        
        const title = document.createElement('div');
        title.className = 'result-title';
        title.textContent = result.nom;
        
        const subtitle = document.createElement('div');
        subtitle.className = 'result-subtitle';
        subtitle.textContent = result.ville;
        
        // Add badge if we have a count
        if (result.count) {
          const badge = document.createElement('span');
          badge.className = 'result-badge';
          badge.textContent = result.count;
          titleContainer.appendChild(badge);
        }
        
        titleContainer.appendChild(title);
        titleContainer.appendChild(subtitle);
        resultItem.appendChild(titleContainer);
        
        // Add click event to select a result
        resultItem.addEventListener('click', function() {
          searchInput.value = result.nom;
          document.querySelector('input[name="ville"]').value = result.ville;
          hideSearchOverlay();
          
          // Optional: auto-submit the form
          // document.querySelector('form').submit();
        });
        
        searchOverlay.appendChild(resultItem);
      });
    }
  });