
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";

const baseUrl="https://localhost:7231/";
const structureSearchCasesUrl = "api/structure/search-cases";                //case/search - generic search-cases
const getStructureUrl = "api/structure/get-structure";                       //case/search - generic search-cases
const getAbbreviationUrl = "api/abbreviation/get-abbreviation";                       //case/search - generic search-cases

const searchGetStructureByIdUrl = "api/structure/get-structure-by-id";      //structure/get-structure-by-id

const favoriteGetMyItemsUrl = "api/favorite/get-my-favorites";          //favorites/get
const favoritesDeleteUrl = "api/favorite/delete"; //favorites/delete
const favoritesAddUrl = "apu/favorite/add";          //favorites/add

const emailAddUrl = "api/email/add-to-advocat";
const emailGetRegistered = "api/email/get-registered";
const emailGetUrl = "api/email/get";

const serviceAddUrl = "api/service/add-service";
const serviceGetUrl = "api/service/get-services";

export  function   addCaseToFavorites(nodeIsd) {
  return fetch(baseUrl + favoritesAddUrl, {
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
      const res = await  fetch(baseUrl + favoritesDeleteUrl, {
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
  return fetch(baseUrl + structureSearchCasesUrl, {
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
  return fetch(baseUrl + searchGetStructureByIdUrl+"?parentId=" + nodeId)
      .then(res => res.json())   
      .catch(error => {
        console.error("Błąd fetch:", error); 
        showError("Get struture failed: " + error);  
      });
}

 
export function getMyFavorites(nodeId) {
  return fetch(baseUrl + favoriteGetMyItemsUrl)
      .then(res => res.json())
      .catch(error => {
        console.error("Błąd fetch:", error); 
       showError("Get my Favorites failed: " + error);  
      });
 
}
  
export function getStructureApi() {

  return fetch(baseUrl + getStructureUrl, {
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

  return fetch(baseUrl + getAbbreviationUrl, {
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

//////
//EMAIL Tab
export function addToAdvocat(emailModel) {

  return fetch(baseUrl + emailAddUrl, {
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
export function getCurrentItem(id) {

  return fetch(baseUrl + emailGetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    
    body: JSON.stringify({ id: id })
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
  


//////
//SERVICE Tab
export function addService(serviceModel) {

  return fetch(baseUrl + serviceAddUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(serviceModel)
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .catch(error => {
    console.error("Błąd fetch:", error);
    showError("Add Service failed: " + error);
  });

}


export function getRegisteredService() 
{
  return fetch(baseUrl + serviceGetUrl, {
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
    showError("Get Service Failed: " + error);
  });
}