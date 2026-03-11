import React from 'react';
import { PersonResponse } from '@interfaces/IPerson';
import './person.css';
import { useTranslation } from 'react-i18next';

function getFullName(data: PersonResponse): string {
  const parts = [];
  if (data.titel) parts.push(data.titel);
  if (data.vorname) parts.push(data.vorname);
  if (data.name1) parts.push(data.name1);
  if (data.name2) parts.push(data.name2);
  if (data.name3) parts.push(data.name3);
  return parts.join(' ') || data.nKurz || '';
}

export default function CustomItem(data: PersonResponse) {
  const { t: translate } = useTranslation('person');
  const fullName = getFullName(data) || translate('unknownPerson');
  return (
    <div className="person-item-root">
      {/* Full name header */}
      <div className="person-item-header">
        <i className="dx-icon dx-icon-user person-item-icon person-item-name-icon" />
        <span className="person-item-name-text">{fullName}</span>
      </div>

      {/* Address Section */}
      {data.adressdaten && (
        <div className="person-item-section-row">
          <i className="dx-icon dx-icon-home person-item-icon" />
          <div>
          <div className="person-item-section-label">{translate('contactAddress')}</div>
            <div className="person-item-detail">
              {data.adressdaten.straße && <div>{data.adressdaten.straße}</div>}
              {(data.adressdaten.plz || data.adressdaten.ort) && (
                <div>
                  {data.adressdaten.plz} {data.adressdaten.ort}
                  {data.adressdaten.landeskennzeichenIso2 && `, ${data.adressdaten.landeskennzeichenIso2}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contacts Section */}
      {data.kontakte && data.kontakte.length > 0 && (
        <>
          {data.kontakte.map((contact, index) => {
            let icon = "dx-icon-info";
            let label = contact.art;
            
            // Map contact types to appropriate icons
            if (contact.art?.toLowerCase().includes('telefon') || contact.art?.toLowerCase().includes('phone')) {
              icon = "dx-icon-tel";
              label = translate('contactTelefon');
            } else if (contact.art?.toLowerCase().includes('email') || contact.art?.toLowerCase().includes('mail')) {
              icon = "dx-icon-email";
              label = translate('contactEmail');
            } else if (contact.art?.toLowerCase().includes('website') || contact.art?.toLowerCase().includes('web')) {
              icon = "dx-icon-globe";
              label = translate('contactWebsite');
            }

            return (
        <div key={index} className="person-item-section-row">
                <i className={`dx-icon ${icon} person-item-icon`} />
                <div>
                  <div className="person-item-section-label">{label}</div>
                  <div className="person-item-detail">
                    {contact.art?.toLowerCase().includes('website') ? (
                      <a href={contact.telefonnummerOderAdresse} target="_blank" rel="noopener noreferrer">
                        {contact.telefonnummerOderAdresse}
                      </a>
                    ) : (
                      contact.telefonnummerOderAdresse
                    )}
                    {contact.bemerkung && (
                      <span className="person-item-contact-note">({contact.bemerkung})</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Show a message if no contact data is available */}
      {(!data.adressdaten && (!data.kontakte || data.kontakte.length === 0)) && (
        <div className="person-item-empty">
          {translate('noContactInfo')}
        </div>
      )}
    </div>
  );
}
