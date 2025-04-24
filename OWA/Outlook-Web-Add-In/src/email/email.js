import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { addCaseToFavorites, removeCaseFromFavorites, getMyFavorites, getStructure, searchCases } from "../helpers/webApiReqests";
 
 
export function initEmail() 
{
    // document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure; 
    // document.getElementById("search-case-id").onclick = CaseSearchStructure;
    setOptions();
    showSuccess("EmailOpened", "Your Message"); 
}