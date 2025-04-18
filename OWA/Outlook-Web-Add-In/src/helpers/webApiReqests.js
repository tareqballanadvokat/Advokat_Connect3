const url="https://localhost:7231/WeatherForecast/";

export  function   addCaseToFavorites(nodeIsd) {
  return fetch(url+"AddToFavorites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ nodeId: nodeIsd })
  })
    .then(res => res.json())
    .catch(error => {
      showError("Add to favorites list failed: " + error); 
    });
}

export async function removeCaseFromFavorites(nodeId) {
     try {
      const res = await  fetch(url+"RemoveFromFavorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nodeId: nodeId })
      });
  
      if (!res.ok) {
        
        showError("Removed from favorites list failed: " + res.status); 
        throw new Error(`Błąd HTTP ${res.status}: ${res.statusText}`);
      }
  
    //  const data = await res.json();
      return res;
  
    } catch (err) {
      console.error("Błąd podczas wyszukiwania:", err);
      
     showError("Removed from favorites list failed: " + err); 
      throw err;  
    }


}

export function searchCases(searchQuery) {
  return fetch(url+"SearchCases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: searchQuery })
  })
    .then(res => res.json())
    .catch(error => {
      console.error("Błąd fetch:", error);
     showError("Search failed: " + error);  
    });
}

export function getStructure(nodeId) {
  return fetch(url+"GetStructureById?parentId=" + nodeId)
      .then(res => res.json())   
      .catch(error => {
        console.error("Błąd fetch:", error); 
        showError("Get struture failed: " + error);  
      });
}

 
export function getMyFavorites(nodeId) {
  return fetch(url+"GetMyFavorites")
      .then(res => res.json())
      .catch(error => {
        console.error("Błąd fetch:", error); 
       showError("Get my Favorites failed: " + error);  
      });
 
}
  