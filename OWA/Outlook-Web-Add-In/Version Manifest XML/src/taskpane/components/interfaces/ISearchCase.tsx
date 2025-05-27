 
export interface CaseItem {
  caseId: string;
  causa: string;
  name: string;
}

export interface SearchProps {
  onCaseSelect: (caseId: string) => void;
}
