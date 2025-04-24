const url="https://localhost:7231/WeatherForecast/";
const caseAddToFavorites = "AddToFavorites";
const caseSearchCases = "SearchCases";
const caseGetStructureById = "GetStructureById";
const caseGetMyFavorites = "GetMyFavorites";
const caseRemoveFromFavorites = "RemoveFromFavorites";

export  function   addCaseToFavorites(nodeIsd) {
  return fetch(url + caseAddToFavorites, {
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
      const res = await  fetch(url + caseRemoveFromFavorites, {
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
  return fetch(url + caseSearchCases, {
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
  return fetch(url + caseGetStructureById+"?parentId=" + nodeId)
      .then(res => res.json())   
      .catch(error => {
        console.error("Błąd fetch:", error); 
        showError("Get struture failed: " + error);  
      });
}

 
export function getMyFavorites(nodeId) {
  return fetch(url + caseGetMyFavorites)
      .then(res => res.json())
      .catch(error => {
        console.error("Błąd fetch:", error); 
       showError("Get my Favorites failed: " + error);  
      });
 
}
  