// Service-related interfaces and models

// Service data model for API communication
export interface ServiceModel {
  caseId: number;
  serviceAbbreviationType: string;
  serviceSB: string;
  serviceTime: string;
  serviceText: string;
  internetMessageId: string;
  userId: number;
}

// Service component props (if needed in the future)
export interface ServiceSectionProps {
  // Currently empty since we use Redux, but keeping for future extensibility
}

// Registered service item
export interface RegisteredService {
  id: string;
  date: string;
  abbreviation: string;
  text: string;
  time: string;
}
