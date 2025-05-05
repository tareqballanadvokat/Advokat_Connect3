
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";

const baseUrl="https://localhost:7231/";
const structureSearchCases = "api/structure/search-cases";                //case/search - generic search-cases
const getStructureEndpoint = "api/structure/get-structure";                       //case/search - generic search-cases
const getSAbbreviation = "api/abbreviation/get-abbreviation";                       //case/search - generic search-cases

const searchGetStructureById = "api/structure/get-structure-by-id";      //structure/get-structure-by-id

const favoriteGetMyItems = "api/favorite/get-my-favorites";          //favorites/get
const favoritesRemoveFromList = "api/favorite/delete"; //favorites/delete
const favoritesAddToList = "apu/favorite/add";          //favorites/add

const emailAddToAdvocat = "api/email/add-to-advocat";
const emailGetRegistered = "api/email/get-registered";

export  function   addCaseToFavorites(nodeIsd) {
  return fetch(baseUrl + favoritesAddToList, {
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
      const res = await  fetch(baseUrl + favoritesRemoveFromList, {
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
  return fetch(baseUrl + structureSearchCases, {
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
  return fetch(baseUrl + searchGetStructureById+"?parentId=" + nodeId)
      .then(res => res.json())   
      .catch(error => {
        console.error("Błąd fetch:", error); 
        showError("Get struture failed: " + error);  
      });
}

 
export function getMyFavorites(nodeId) {
  return fetch(baseUrl + favoriteGetMyItems)
      .then(res => res.json())
      .catch(error => {
        console.error("Błąd fetch:", error); 
       showError("Get my Favorites failed: " + error);  
      });
 
}
  

//////
//EMAIL Tab
export function addToAdvocat(emailModel) {

  return fetch(baseUrl + emailAddToAdvocat, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailModel)
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .catch(error => {
    console.error("Błąd fetch:", error);
    showError("Add To Advocat failed: " + error);
  });

}


export function getStructureApi() {

  return fetch(baseUrl + getStructureEndpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .catch(error => {
    console.error("Błąd fetch:", error);
    showError("Get Emails Failed: " + error);
  });

}


export function getAbbreviationApi() {

  return fetch(baseUrl + getSAbbreviation, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .catch(error => {
    console.error("Błąd fetch:", error);
    showError("Get Emails Failed: " + error);
  });

}



export function getRegisteredEmails() {

  return fetch(baseUrl + emailGetRegistered, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .catch(error => {
    console.error("Błąd fetch:", error);
    showError("Get Emails Failed: " + error);
  });

}
  