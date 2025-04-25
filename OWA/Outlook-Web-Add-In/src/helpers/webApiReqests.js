
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";

const baseUrl="https://localhost:7231/";
const caseAddToFavorites = "WeatherForecast/AddToFavorites";          //favorites/add
const caseSearchCases = "WeatherForecast/SearchCases";                //case/search
const caseGetStructureById = "WeatherForecast/GetStructureById";      //structure/get-structure-by-id
const caseGetMyFavorites = "WeatherForecast/GetMyFavorites";          //favorites/get
const caseRemoveFromFavorites = "WeatherForecast/RemoveFromFavorites"; //favorites/delete

const emailAddToAdvocat = "api/email/add-to-advocat";

export  function   addCaseToFavorites(nodeIsd) {
  return fetch(baseUrl + caseAddToFavorites, {
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
      const res = await  fetch(baseUrl + caseRemoveFromFavorites, {
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
  return fetch(baseUrl + caseSearchCases, {
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
  return fetch(baseUrl + caseGetStructureById+"?parentId=" + nodeId)
      .then(res => res.json())   
      .catch(error => {
        console.error("Błąd fetch:", error); 
        showError("Get struture failed: " + error);  
      });
}

 
export function getMyFavorites(nodeId) {
  return fetch(baseUrl + caseGetMyFavorites)
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
  