import React from 'react';
import { PersonResponse } from '../../interfaces/IPerson';

function getFullName(data: PersonResponse): string {
  const parts = [];
  if (data.titel) parts.push(data.titel);
  if (data.vorname) parts.push(data.vorname);
  if (data.name1) parts.push(data.name1);
  if (data.name2) parts.push(data.name2);
  if (data.name3) parts.push(data.name3);
  return parts.join(' ') || data.nKurz || 'Unknown Person';
}

export default function CustomItem(data: PersonResponse) {
  const fullName = getFullName(data);
  return (
    <div style={{ padding: 16 }}>
      {/* Full name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e0e0e0' }}>
        <i className="dx-icon dx-icon-user" style={{ fontSize: 18, color: '#555', flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-word' }}>{fullName}</span>
      </div>

      {/* Address Section */}
      {data.adressdaten && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <i className="dx-icon dx-icon-home" style={{ fontSize: 16, marginTop: 2, color: '#666' }} />
          <div>
            <div style={{ fontWeight: 500 }}>Adress</div>
            <div style={{ color: '#f0dcdcff', fontSize: 14 }}>
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
              label = "Telefon";
            } else if (contact.art?.toLowerCase().includes('email') || contact.art?.toLowerCase().includes('mail')) {
              icon = "dx-icon-email";
              label = "Email";
            } else if (contact.art?.toLowerCase().includes('website') || contact.art?.toLowerCase().includes('web')) {
              icon = "dx-icon-globe";
              label = "Website";
            }

            return (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                <i className={`dx-icon ${icon}`} style={{ fontSize: 16, marginTop: 2, color: '#666' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>{label}</div>
                  <div style={{ color: '#f0dcdcff', fontSize: 14 }}>
                    {contact.art?.toLowerCase().includes('website') ? (
                      <a href={contact.telefonnummerOderAdresse} target="_blank" rel="noopener noreferrer">
                        {contact.telefonnummerOderAdresse}
                      </a>
                    ) : (
                      contact.telefonnummerOderAdresse
                    )}
                    {contact.bemerkung && (
                      <span style={{ marginLeft: 8, fontStyle: 'italic' }}>({contact.bemerkung})</span>
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
        <div style={{ color: '#999', fontStyle: 'italic', padding: 8 }}>
          No contact information available
        </div>
      )}
    </div>
  );
}
